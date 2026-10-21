/**
 * The test file patterns a project is created with. It mirrors the column
 * default of `Project.testFilePatterns` in `apps/api/prisma/schema.prisma`,
 * which Prisma cannot import, so `default-test-file-patterns.spec.ts` in the
 * API keeps the two in step.
 *
 * Changing the default affects new projects only: existing projects keep the
 * patterns they have and can edit them in the repository settings.
 */
export const DEFAULT_TEST_FILE_PATTERNS: readonly string[] = [
  '*.spec.ts',
  '*.test.ts',
  '*.spec.tsx',
  '*.test.tsx',
  '*.e2e-spec.ts',
];
