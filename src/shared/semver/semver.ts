export interface ParsedSemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
}

// SemVer 2.0.0 official regex
const SEMVER_STRICT_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Parses a semantic version string.
 * Returns ParsedSemVer if valid according to SemVer 2.0.0, or null if invalid.
 */
export function parseSemVer(v: string): ParsedSemVer | null {
  if (!v || typeof v !== 'string') {
    return null;
  }
  const clean = v.trim().replace(/^v/i, '');
  const match = clean.match(SEMVER_STRICT_REGEX);
  if (!match) {
    return null;
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || undefined,
    build: match[5] || undefined,
    raw: v.trim()
  };
}

export function isValidSemVer(v: string): boolean {
  return parseSemVer(v) !== null;
}

function comparePrerelease(prerelease1: string | undefined, prerelease2: string | undefined): number {
  if (!prerelease1 && prerelease2) return 1;
  if (prerelease1 && !prerelease2) return -1;
  if (!prerelease1 && !prerelease2) return 0;

  const parts1 = prerelease1!.split('.');
  const parts2 = prerelease2!.split('.');
  const len = Math.min(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const id1 = parts1[i];
    const id2 = parts2[i];

    if (id1 === id2) continue;

    const isNum1 = /^\d+$/.test(id1);
    const isNum2 = /^\d+$/.test(id2);

    if (isNum1 && isNum2) {
      const n1 = parseInt(id1, 10);
      const n2 = parseInt(id2, 10);
      if (n1 !== n2) return n1 > n2 ? 1 : -1;
    } else if (isNum1 && !isNum2) {
      return -1;
    } else if (!isNum1 && isNum2) {
      return 1;
    } else {
      if (id1 !== id2) return id1 > id2 ? 1 : -1;
    }
  }

  if (parts1.length === parts2.length) return 0;
  return parts1.length > parts2.length ? 1 : -1;
}

/**
 * Compares two SemVer versions.
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 == v2
 */
export function compareSemVer(v1: string, v2: string): number {
  const p1 = parseSemVer(v1);
  const p2 = parseSemVer(v2);

  if (!p1 && !p2) return 0;
  if (p1 && !p2) return 1;
  if (!p1 && p2) return -1;

  if (p1!.major > p2!.major) return 1;
  if (p1!.major < p2!.major) return -1;

  if (p1!.minor > p2!.minor) return 1;
  if (p1!.minor < p2!.minor) return -1;

  if (p1!.patch > p2!.patch) return 1;
  if (p1!.patch < p2!.patch) return -1;

  return comparePrerelease(p1!.prerelease, p2!.prerelease);
}

/**
 * Checks if a version satisfies a range requirement.
 * Supported range formats:
 * - exact version: "1.2.3"
 * - minimum version: ">=1.2.0" or ">1.2.0"
 * - caret range: "^1.2.0" (compatible with same major)
 * - tilde range: "~1.2.0" (compatible with same minor)
 * - wildcard: "*" or "latest"
 */
export function satisfiesSemVer(version: string, range: string): boolean {
  if (!range || range === '*' || range === 'latest' || range === 'any') return true;

  const target = parseSemVer(version);
  if (!target) return false;

  const cleanRange = range.trim();

  // Handle space-separated compound ranges (e.g. ">=1.0.0 <2.0.0")
  if (cleanRange.includes(' ')) {
    const parts = cleanRange.split(/\s+/).filter(Boolean);
    return parts.every(part => satisfiesSemVer(version, part));
  }

  // Handle caret range: ^1.2.3 (>= 1.2.3 and < 2.0.0)
  if (cleanRange.startsWith('^')) {
    const minVerStr = cleanRange.substring(1).trim();
    const minVer = parseSemVer(minVerStr);
    if (!minVer) return false;

    if (compareSemVer(version, minVerStr) < 0) return false;
    if (minVer.major > 0) {
      return target.major === minVer.major;
    } else if (minVer.minor > 0) {
      return target.major === 0 && target.minor === minVer.minor;
    } else {
      return target.major === 0 && target.minor === 0 && target.patch === minVer.patch;
    }
  }

  // Handle tilde range: ~1.2.3 (>= 1.2.3 and < 1.3.0)
  if (cleanRange.startsWith('~')) {
    const minVerStr = cleanRange.substring(1).trim();
    const minVer = parseSemVer(minVerStr);
    if (!minVer) return false;

    if (compareSemVer(version, minVerStr) < 0) return false;
    return target.major === minVer.major && target.minor === minVer.minor;
  }

  // Handle >= comparator
  if (cleanRange.startsWith('>=')) {
    const minVerStr = cleanRange.substring(2).trim();
    return compareSemVer(version, minVerStr) >= 0;
  }

  // Handle > comparator
  if (cleanRange.startsWith('>')) {
    const minVerStr = cleanRange.substring(1).trim();
    return compareSemVer(version, minVerStr) > 0;
  }

  // Handle <= comparator
  if (cleanRange.startsWith('<=')) {
    const maxVerStr = cleanRange.substring(2).trim();
    return compareSemVer(version, maxVerStr) <= 0;
  }

  // Handle < comparator
  if (cleanRange.startsWith('<')) {
    const maxVerStr = cleanRange.substring(1).trim();
    return compareSemVer(version, maxVerStr) < 0;
  }

  // Handle = prefix
  if (cleanRange.startsWith('=')) {
    const exactVerStr = cleanRange.substring(1).trim();
    return compareSemVer(version, exactVerStr) === 0;
  }

  // Exact match
  return compareSemVer(version, cleanRange) === 0;
}
