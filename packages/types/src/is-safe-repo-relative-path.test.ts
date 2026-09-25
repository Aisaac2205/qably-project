import { describe, it, expect } from 'vitest';
import { isSafeRepoRelativePath } from './is-safe-repo-relative-path';

describe('isSafeRepoRelativePath', () => {
  it('accepts a simple relative path', () => {
    expect(isSafeRepoRelativePath('src/checkout.spec.ts')).toBe(true);
  });

  it('accepts a nested relative path with a leading segment', () => {
    expect(isSafeRepoRelativePath('a/b/c/d.ts')).toBe(true);
  });

  it('accepts a single-segment file name', () => {
    expect(isSafeRepoRelativePath('README.md')).toBe(true);
  });

  it('rejects a path containing a parent-directory segment', () => {
    expect(isSafeRepoRelativePath('../etc/passwd')).toBe(false);
  });

  it('rejects a path containing a parent-directory segment in the middle', () => {
    expect(isSafeRepoRelativePath('src/../../etc/passwd')).toBe(false);
  });

  it('rejects a path containing a current-directory segment', () => {
    expect(isSafeRepoRelativePath('./src/checkout.spec.ts')).toBe(false);
  });

  it('rejects an absolute POSIX path', () => {
    expect(isSafeRepoRelativePath('/etc/passwd')).toBe(false);
  });

  it('rejects a path using backslashes', () => {
    expect(isSafeRepoRelativePath('src\\checkout.spec.ts')).toBe(false);
  });

  it('rejects a path with an empty segment (double slash)', () => {
    expect(isSafeRepoRelativePath('src//checkout.spec.ts')).toBe(false);
  });

  it('rejects a path with a trailing slash (trailing empty segment)', () => {
    expect(isSafeRepoRelativePath('src/checkout.spec.ts/')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isSafeRepoRelativePath('')).toBe(false);
  });

  it('rejects a path over 300 characters', () => {
    expect(isSafeRepoRelativePath(`${'a'.repeat(298)}.ts`)).toBe(false);
  });

  it('accepts a path exactly 300 characters', () => {
    expect(isSafeRepoRelativePath(`${'a'.repeat(297)}.ts`)).toBe(true);
  });

  it('rejects a path containing a control character', () => {
    expect(isSafeRepoRelativePath('src/checkout\u0000.spec.ts')).toBe(false);
  });
});
