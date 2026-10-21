import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveAutomationKey } from './automation-key';
import type { TestRunner } from './detect-test-runner';
import {
  parseTestDeclarations,
  type TestDeclaration,
} from './parse-test-declarations';

// Copies of real spec files of this repository, taken on 2026-10-20 and kept
// as .txt under __fixtures__ so jest, tsc and eslint never run or lint them,
// and so an edit to the originals cannot break these counts. Each one is
// parsed under its original path, as the extraction would read it. The counts
// were taken by hand from each file.
const FIXTURES = resolve(__dirname, '__fixtures__');

function parseRepoFile(repoPath: string, runnerHint?: TestRunner) {
  const fixture = `${repoPath.slice(repoPath.lastIndexOf('/') + 1)}.txt`;
  const result = parseTestDeclarations({
    filePath: repoPath,
    content: readFileSync(resolve(FIXTURES, fixture), 'utf8'),
    runnerHint,
  });
  if (result.kind !== 'parsed') {
    throw new Error(`expected ${repoPath} to parse, got ${result.kind}`);
  }
  return result;
}

function keyOf(
  declarations: readonly TestDeclaration[],
  title: string,
  options: Parameters<typeof deriveAutomationKey>[1],
) {
  const match = declarations.find((declaration) => declaration.title === title);
  if (match === undefined) throw new Error(`no declaration titled ${title}`);
  return deriveAutomationKey(match, options);
}

describe('parsing real spec files of this repository', () => {
  describe('apps/web/src/test/status-chip.test.tsx (vitest, imports from vitest)', () => {
    const FILE = 'apps/web/src/test/status-chip.test.tsx';
    const VITEST_WEB = {
      runner: 'vitest',
      filePath: FILE,
      pathBase: 'apps/web',
    } as const;

    it('detects vitest from its import', () => {
      expect(parseRepoFile(FILE).runner).toEqual({
        runner: 'vitest',
        evidence: 'import',
      });
    });

    it('finds the 14 declarations counted by hand, 4 of them it.each', () => {
      const { declarations } = parseRepoFile(FILE);

      expect(declarations).toHaveLength(14);
      expect(declarations.filter((d) => d.parametrized)).toHaveLength(4);
      expect(declarations.every((d) => !d.dynamicTitle)).toBe(true);
    });

    it('reads the titles, describe paths and spans of known declarations', () => {
      const { declarations } = parseRepoFile(FILE);

      expect(declarations[0]).toMatchObject({
        kind: 'it',
        title: 'renders pass status with icon and label',
        describePath: ['StatusChip (global)'],
        startLine: 11,
      });
      expect(declarations[7]).toMatchObject({
        title: 'preserves the unscoped %s compatibility contract',
        modifiers: ['each'],
        parametrized: true,
        startLine: 75,
        endLine: 90,
      });
      expect(declarations[13]).toMatchObject({
        title: 'accepts only the CI run vocabulary under the ci-run scope',
        describePath: ['StatusChip (ci-run scope)'],
        startLine: 166,
        endLine: 171,
      });
    });

    it('gives the declarations of each describe the context of that describe', () => {
      const { declarations } = parseRepoFile(FILE);
      const contextOf = (scope: string) =>
        new Set(
          declarations
            .filter((d) => d.describePath[0] === scope)
            .map((d) => d.contextHash),
        );

      // "StatusChip (global)" runs a beforeEach that "ci-run scope" does not.
      const global = contextOf('StatusChip (global)');
      const ciRun = contextOf('StatusChip (ci-run scope)');
      expect(global.size).toBeGreaterThan(0);
      expect(ciRun.size).toBeGreaterThan(0);
      expect([...global].some((hash) => ciRun.has(hash))).toBe(false);
    });

    it('derives the key vitest reports from apps/web, relative to its vitest root', () => {
      const { declarations } = parseRepoFile(FILE);

      expect(
        keyOf(
          declarations,
          'renders pass status with icon and label',
          VITEST_WEB,
        ),
      ).toEqual({
        kind: 'key',
        key: 'src/test/status-chip.test.tsx::StatusChip (global) > renders pass status with icon and label',
        parametrized: false,
      });
      expect(
        keyOf(
          declarations,
          'shows a %s CI run as "%s" with the %s tone',
          VITEST_WEB,
        ),
      ).toEqual({
        kind: 'key',
        key: 'src/test/status-chip.test.tsx::StatusChip (ci-run scope) > shows a %s CI run as "%s" with the %s tone',
        parametrized: true,
      });
    });
  });

  describe('apps/api/src/modules/runs/lib/case-identity.spec.ts (jest, globals only)', () => {
    const FILE = 'apps/api/src/modules/runs/lib/case-identity.spec.ts';

    it('finds no runner evidence of its own and takes the jest hint of its package', () => {
      expect(parseRepoFile(FILE).runner).toEqual({
        runner: 'unknown',
        evidence: 'none',
      });
      expect(parseRepoFile(FILE, 'jest').runner).toEqual({
        runner: 'jest',
        evidence: 'hint',
      });
    });

    it('finds the 23 declarations counted by hand and not the it.each named in a comment', () => {
      const { declarations } = parseRepoFile(FILE);

      expect(declarations).toHaveLength(23);
      expect(declarations.some((d) => d.parametrized)).toBe(false);
      expect(new Set(declarations.map((d) => d.describePath[0]))).toEqual(
        new Set([
          'resolveCaseIdentityKey',
          'findCaseIdentityCollisions',
          'findLegacyKeyCollisions',
          'findLegacyTruncatedClaims',
        ]),
      );
    });

    it('derives the jest-junit key of a known declaration', () => {
      const { declarations } = parseRepoFile(FILE);

      expect(
        keyOf(
          declarations,
          'uses the raw name alone when no classname is reported',
          {
            runner: 'jest',
          },
        ),
      ).toEqual({
        kind: 'key',
        key: 'resolveCaseIdentityKey uses the raw name alone when no classname is reported',
        parametrized: false,
      });
    });
  });

  describe('apps/api/src/modules/suites/suite-list-query.service.spec.ts (jest, nested describes and it.each)', () => {
    const FILE = 'apps/api/src/modules/suites/suite-list-query.service.spec.ts';

    it('finds the 22 declarations counted by hand, 7 of them it.each', () => {
      const { declarations } = parseRepoFile(FILE, 'jest');

      expect(declarations).toHaveLength(22);
      expect(declarations.filter((d) => d.parametrized)).toHaveLength(7);
    });

    it('derives the template key whose rendered rows case-identity.spec.ts quotes from a real jest-junit report', () => {
      const { declarations } = parseRepoFile(FILE, 'jest');
      const title =
        'reads the suites once, the case counts once and the run windows once for sort %s and status %s with %i suites';

      expect(keyOf(declarations, title, { runner: 'jest' })).toEqual({
        kind: 'key',
        key: `SuiteListQueryService.page bounded reads ${title}`,
        parametrized: true,
      });
    });
  });
});
