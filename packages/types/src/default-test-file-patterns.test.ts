import { describe, expect, it } from 'vitest';
import { matchDeclaredTestPattern } from './index';
import { DEFAULT_TEST_FILE_PATTERNS } from './default-test-file-patterns';

function detect(filePath: string): string | undefined {
  return matchDeclaredTestPattern(filePath, DEFAULT_TEST_FILE_PATTERNS);
}

describe('DEFAULT_TEST_FILE_PATTERNS', () => {
  it('declares the five conventions a new project is created with', () => {
    expect([...DEFAULT_TEST_FILE_PATTERNS]).toEqual([
      '*.spec.ts',
      '*.test.ts',
      '*.spec.tsx',
      '*.test.tsx',
      '*.e2e-spec.ts',
    ]);
  });

  it.each([
    ['src/cart/cart.spec.ts', '*.spec.ts'],
    ['src/cart/cart.test.ts', '*.test.ts'],
    ['src/ui/badge.spec.tsx', '*.spec.tsx'],
    ['apps/web/src/ui/badge.test.tsx', '*.test.tsx'],
    ['apps/api/test/review-inbox.e2e-spec.ts', '*.e2e-spec.ts'],
    ['cart.test.tsx', '*.test.tsx'],
  ])('detects %s through %s', (filePath, pattern) => {
    expect(detect(filePath)).toBe(pattern);
  });

  it('does not take an e2e spec for a plain spec, because the dot is literal', () => {
    expect(
      matchDeclaredTestPattern('apps/api/test/review-inbox.e2e-spec.ts', [
        '*.spec.ts',
      ]),
    ).toBeUndefined();
    expect(detect('apps/api/test/review-inbox.e2e-spec.ts')).toBe(
      '*.e2e-spec.ts',
    );
  });

  it('detects a Windows-style path', () => {
    expect(detect('apps\\web\\src\\ui\\badge.test.tsx')).toBe('*.test.tsx');
  });

  it.each([
    'src/ui/badge.tsx',
    'src/ui/badge.ts',
    'src/ui/test-utils.ts',
    'src/ui/badge.test.tsx.snap',
    'src/ui/badge.test.tsx.md',
    'src/ui/badge.stories.tsx',
    'apps/api/test/jest-e2e.json',
    'apps/api/test/e2e-spec.ts',
    'src/ui/badge.e2e-spec.tsx',
  ])('leaves %s alone', (filePath) => {
    expect(detect(filePath)).toBeUndefined();
  });
});
