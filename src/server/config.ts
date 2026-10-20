import crypto from 'node:crypto';
import { centralDatabase } from './db/central-db.js';

// Token Revocation Registry (In-memory L1 cache backed by SQLite L2 persistence)
const revokedTokens = new Map<string, number>();

// JWT Secret handling: strictly required in production runtime; ephemeral 256-bit key used for test/development/build
let secret = process.env['JWT_SECRET'];
const isBuildStep = process.env['npm_lifecycle_event'] === 'build' || process.argv.some(a => a.includes('routes-extractor') || a.includes('prerender'));

if (process.env['NODE_ENV'] === 'production' && !isBuildStep) {
  if (!secret || secret.trim().length < 32) {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable with at least 32 characters is strictly required in production mode. Evaluation aborted.');
  }
} else if (!secret) {
  secret = crypto.randomBytes(32).toString('hex');
}

export const JWT_SECRET = secret;

export function revokeToken(token: string): void {
  try {
    const payload = verifyJwt(token);
    const exp = (payload?.['exp'] as number) || Math.floor(Date.now() / 1000) + 86400;
    revokedTokens.set(token, exp);
    centralDatabase.revokeToken(token, exp);
  } catch {
    const exp = Math.floor(Date.now() / 1000) + 86400;
    revokedTokens.set(token, exp);
    centralDatabase.revokeToken(token, exp);
  }
}

export function isTokenRevoked(token: string): boolean {
  if (revokedTokens.has(token)) {
    const exp = revokedTokens.get(token)!;
    if (exp < Math.floor(Date.now() / 1000)) {
      revokedTokens.delete(token);
      return false;
    }
    return true;
  }
  // Check persistent storage in SQLite (survives server restarts)
  if (centralDatabase.isTokenRevoked(token)) {
    revokedTokens.set(token, Math.floor(Date.now() / 1000) + 3600);
    return true;
  }
  return false;
}

export function signJwt(payload: Record<string, unknown>, expiresInSeconds = 86400): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${encodedHeader}.${encodedPayload}`).digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(token: string): Record<string, unknown> | null {
  try {
    if (isTokenRevoked(token)) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${encodedHeader}.${encodedPayload}`).digest('base64url');
    
    // Constant-time signature comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function refreshJwt(token: string, expiresInSeconds = 86400): string | null {
  const payload = verifyJwt(token);
  if (!payload) return null;
  
  // Revoke old token on refresh to prevent re-use
  revokeToken(token);
  
  // Copy payload excluding old exp/iat
  const newPayload: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(payload)) {
    if (key !== 'exp' && key !== 'iat') {
      newPayload[key] = val;
    }
  }
  
  return signJwt(newPayload, expiresInSeconds);
}

/**
 * Secure Scrypt Password Hashing with Salt & Constant-Time Verification
 */
export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHashOrPlain: string): boolean {
  if (!storedHashOrPlain || !password) return false;
  
  if (storedHashOrPlain.startsWith('scrypt:')) {
    const parts = storedHashOrPlain.split(':');
    if (parts.length !== 3) return false;
    const [, salt, hash] = parts;
    const computed = crypto.scryptSync(password, salt, 64).toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Robust AES-256-GCM encryption at rest for sensitive fields (such as MFA secrets).
 */
export const MFA_ENCRYPTION_KEY = process.env['MFA_ENCRYPTION_KEY'] || process.env['HQ_ADMIN_SECRET'] || JWT_SECRET;

export function encryptMfaSecret(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(MFA_ENCRYPTION_KEY).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `enc:${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decryptMfaSecret(ciphertext: string): string {
  if (!ciphertext) return '';
  if (!ciphertext.startsWith('enc:')) {
    return ciphertext; // Fallback for legacy plaintext secrets
  }
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) return ciphertext;
    const [, ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const key = crypto.createHash('sha256').update(MFA_ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return ciphertext;
  }
}

/**
 * RFC 6238 Standard TOTP Verification
 */
export function verifyTotpCode(secretKey: string, code: string): boolean {
  if (!code || String(code).trim().length !== 6) return false;
  const cleanCode = String(code).trim();
  const timeStep = Math.floor(Date.now() / 1000 / 30);
  
  for (let window = -1; window <= 1; window++) {
    const step = timeStep + window;
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(0, 0);
    buf.writeUInt32BE(step, 4);
    
    const hmac = crypto.createHmac('sha1', Buffer.from(secretKey));
    hmac.update(buf);
    const digest = hmac.digest();
    
    const offset = digest[digest.length - 1] & 0xf;
    const codeNum = ((digest[offset] & 0x7f) << 24) |
                    ((digest[offset + 1] & 0xff) << 16) |
                    ((digest[offset + 2] & 0xff) << 8) |
                    (digest[offset + 3] & 0xff);
    
    const expectedCode = String(codeNum % 1000000).padStart(6, '0');
    try {
      if (crypto.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(expectedCode))) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}
