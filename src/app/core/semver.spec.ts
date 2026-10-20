import { describe, it, expect } from 'vitest';
import { parseSemVer, compareSemVer, satisfiesSemVer, isValidSemVer } from './semver';

describe('SemVer Engine (Strict SemVer 2.0.0)', () => {
  it('should parse standard semantic versions correctly', () => {
    const v = parseSemVer('1.2.3');
    expect(v).not.toBeNull();
    expect(v!.major).toBe(1);
    expect(v!.minor).toBe(2);
    expect(v!.patch).toBe(3);
    expect(v!.prerelease).toBeUndefined();
    expect(v!.build).toBeUndefined();
  });

  it('should parse prerelease and build metadata correctly', () => {
    const v = parseSemVer('2.0.0-beta.1+exp.sha.5114f85');
    expect(v).not.toBeNull();
    expect(v!.major).toBe(2);
    expect(v!.minor).toBe(0);
    expect(v!.patch).toBe(0);
    expect(v!.prerelease).toBe('beta.1');
    expect(v!.build).toBe('exp.sha.5114f85');
  });

  it('should return null for invalid semver strings (not default to 0.0.0)', () => {
    expect(parseSemVer('banana')).toBeNull();
    expect(parseSemVer('1.0')).toBeNull();
    expect(parseSemVer('1.0.0.0')).toBeNull();
    expect(parseSemVer('01.0.0')).toBeNull();
    expect(parseSemVer('')).toBeNull();
    expect(isValidSemVer('banana')).toBe(false);
    expect(isValidSemVer('1.0.0')).toBe(true);
    expect(isValidSemVer('v2.1.4-rc.1')).toBe(true);
  });

  it('should compare versions in accordance with SemVer 2.0.0 specification', () => {
    expect(compareSemVer('1.0.0', '0.9.9')).toBe(1);
    expect(compareSemVer('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemVer('1.0.0', '1.0.1')).toBe(-1);
    expect(compareSemVer('2.1.0', '2.0.9')).toBe(1);
    expect(compareSemVer('1.0.0', '1.0.0-rc.1')).toBe(1);
    
    // Numeric prerelease comparison checks
    expect(compareSemVer('1.0.0-alpha.2', '1.0.0-alpha.10')).toBe(-1);
    expect(compareSemVer('1.0.0-alpha.10', '1.0.0-alpha.2')).toBe(1);
    expect(compareSemVer('1.0.0-beta.2', '1.0.0-beta.11')).toBe(-1);
    expect(compareSemVer('1.0.0-alpha.10', '1.0.0-beta.2')).toBe(-1); // lexicographical for beta vs alpha
  });

  it('should correctly evaluate caret (^) ranges', () => {
    expect(satisfiesSemVer('1.2.3', '^1.2.0')).toBe(true);
    expect(satisfiesSemVer('1.9.9', '^1.2.0')).toBe(true);
    expect(satisfiesSemVer('2.0.0', '^1.2.0')).toBe(false);
    expect(satisfiesSemVer('1.1.0', '^1.2.0')).toBe(false);
    expect(satisfiesSemVer('banana', '^1.2.0')).toBe(false);
  });

  it('should correctly evaluate tilde (~) ranges', () => {
    expect(satisfiesSemVer('1.2.5', '~1.2.0')).toBe(true);
    expect(satisfiesSemVer('1.3.0', '~1.2.0')).toBe(false);
    expect(satisfiesSemVer('1.1.9', '~1.2.0')).toBe(false);
  });

  it('should correctly evaluate comparison operators (>=, <=, >, <)', () => {
    expect(satisfiesSemVer('2.5.0', '>=2.0.0')).toBe(true);
    expect(satisfiesSemVer('1.9.0', '>=2.0.0')).toBe(false);
    expect(satisfiesSemVer('2.0.0', '<3.0.0')).toBe(true);
    expect(satisfiesSemVer('3.0.0', '<3.0.0')).toBe(false);
    expect(satisfiesSemVer('banana', '>=1.0.0')).toBe(false);
  });

  it('should handle wildcards and compound ranges', () => {
    expect(satisfiesSemVer('1.5.2', '*')).toBe(true);
    expect(satisfiesSemVer('1.5.2', 'any')).toBe(true);
    expect(satisfiesSemVer('1.5.0', '>=1.0.0 <2.0.0')).toBe(true);
    expect(satisfiesSemVer('2.0.0', '>=1.0.0 <2.0.0')).toBe(false);
  });

  it('should strictly evaluate exact versions without range operators', () => {
    expect(satisfiesSemVer('1.0.0', '1.0.0')).toBe(true);
    expect(satisfiesSemVer('1.0.1', '1.0.0')).toBe(false);
    expect(satisfiesSemVer('2.0.0', '1.0.0')).toBe(false);
    expect(satisfiesSemVer('1.0.0', '=1.0.0')).toBe(true);
    expect(satisfiesSemVer('1.0.1', '=1.0.0')).toBe(false);
    expect(satisfiesSemVer('1.0.0', 'banana')).toBe(false);
  });
});
