import { resolveCaseIdentityKey } from '../../../runs/lib/case-identity';
import { parseJunitXml } from '../../../runs/lib/parse-junit-xml';
import {
  deriveAutomationKey,
  type AutomationKeyDeclaration,
} from './automation-key';

function declaration(
  overrides: Partial<AutomationKeyDeclaration> = {},
): AutomationKeyDeclaration {
  return {
    title: 'adds an item',
    dynamicTitle: false,
    describePath: ['Cart'],
    dynamicDescribePath: false,
    parametrized: false,
    ...overrides,
  };
}

const VITEST_AT_ROOT = {
  runner: 'vitest',
  filePath: 'src/features/cart/cart.test.ts',
  pathBase: '',
} as const;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// The identity the runs side stores for one reported testcase: the XML goes
// through the same parser and identity rule as POST /runs/ingest/junit.
function ingestedIdentity(testcase: {
  classname: string;
  name: string;
}): string {
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<testsuites name="tests">
  <testsuite name="suite" tests="1">
    <testcase classname="${escapeXml(testcase.classname)}" name="${escapeXml(testcase.name)}" time="0.001"/>
  </testsuite>
</testsuites>`;
  const [reported] = parseJunitXml(xml).cases;
  return resolveCaseIdentityKey({
    name: reported.name,
    className: reported.className,
  });
}

// vitest 4 junit reporter: classname is the file path relative to the vitest
// root, name is the describe chain and the title joined by " > ".
function vitestTestcase(
  relativePath: string,
  describePath: readonly string[],
  title: string,
) {
  return {
    classname: relativePath,
    name: [...describePath, title].join(' > '),
  };
}

// jest-junit 17 default templates: "{classname} {title}" for both attributes,
// where {classname} is the describe chain joined by a single space.
function jestJunitTestcase(describePath: readonly string[], title: string) {
  const name = `${describePath.join(' ')} ${title}`;
  return { classname: name, name };
}

describe('deriveAutomationKey', () => {
  describe('vitest', () => {
    it('joins the file path to the describe chain and title with "::" and " > "', () => {
      expect(
        deriveAutomationKey(
          declaration({
            describePath: ['Cart', 'totals'],
            title: 'sums the lines',
          }),
          VITEST_AT_ROOT,
        ),
      ).toEqual({
        kind: 'key',
        key: 'src/features/cart/cart.test.ts::Cart > totals > sums the lines',
        parametrized: false,
      });
    });

    it('uses the title alone after "::" for a test outside any describe', () => {
      expect(
        deriveAutomationKey(declaration({ describePath: [] }), VITEST_AT_ROOT),
      ).toMatchObject({ key: 'src/features/cart/cart.test.ts::adds an item' });
    });

    it('makes the path relative to the vitest root given as pathBase', () => {
      expect(
        deriveAutomationKey(
          declaration({
            describePath: ['StatusChip (global)'],
            title: 'renders pass status with icon and label',
          }),
          {
            runner: 'vitest',
            filePath: 'apps/web/src/test/status-chip.test.tsx',
            pathBase: 'apps/web',
          },
        ),
      ).toMatchObject({
        key: 'src/test/status-chip.test.tsx::StatusChip (global) > renders pass status with icon and label',
      });
    });

    it.each([['apps/web/'], ['./apps/web'], ['apps\\web'], ['/apps/web/']])(
      'accepts the path base written as %s',
      (pathBase) => {
        expect(
          deriveAutomationKey(declaration(), {
            runner: 'vitest',
            filePath: 'apps\\web\\src\\cart.test.ts',
            pathBase,
          }),
        ).toMatchObject({ key: 'src/cart.test.ts::Cart > adds an item' });
      },
    );

    it.each([[''], ['.'], ['./']])(
      'treats the path base %j as the repository root',
      (pathBase) => {
        expect(
          deriveAutomationKey(declaration(), {
            runner: 'vitest',
            filePath: './src/cart.test.ts',
            pathBase,
          }),
        ).toMatchObject({ key: 'src/cart.test.ts::Cart > adds an item' });
      },
    );

    it('reports a file outside the path base as unavailable instead of guessing a path', () => {
      expect(
        deriveAutomationKey(declaration(), {
          runner: 'vitest',
          filePath: 'apps/website/src/cart.test.ts',
          pathBase: 'apps/web',
        }),
      ).toEqual({ kind: 'unavailable', reason: 'outside-path-base' });
    });
  });

  describe('jest', () => {
    it('joins the describe chain and the title with a single space', () => {
      expect(
        deriveAutomationKey(
          declaration({
            describePath: ['Cart', 'totals'],
            title: 'sums the lines',
          }),
          { runner: 'jest' },
        ),
      ).toEqual({
        kind: 'key',
        key: 'Cart totals sums the lines',
        parametrized: false,
      });
    });

    it('uses the bare title for a test outside any describe', () => {
      expect(
        deriveAutomationKey(declaration({ describePath: [] }), {
          runner: 'jest',
        }),
      ).toMatchObject({ key: 'adds an item' });
    });

    it('renders a "$" pattern in a title the way jest-junit String.replace templates do', () => {
      expect(
        deriveAutomationKey(declaration({ title: 'costs $$5 more' }), {
          runner: 'jest',
        }),
      ).toMatchObject({ key: 'Cart costs $5 more' });
    });
  });

  describe('keys that cannot be derived', () => {
    it.each([
      ['jest', { runner: 'jest' } as const],
      ['vitest', VITEST_AT_ROOT],
    ])('reports a dynamic title as unavailable for %s', (_runner, options) => {
      expect(
        deriveAutomationKey(
          declaration({ title: '`adds ${count} items`', dynamicTitle: true }),
          options,
        ),
      ).toEqual({ kind: 'unavailable', reason: 'dynamic-title' });
    });

    it('reports a dynamic describe title as unavailable', () => {
      expect(
        deriveAutomationKey(
          declaration({
            describePath: ['CartService.name'],
            dynamicDescribePath: true,
          }),
          { runner: 'jest' },
        ),
      ).toEqual({ kind: 'unavailable', reason: 'dynamic-title' });
    });
  });

  describe('parametrized declarations', () => {
    it('returns the template key and flags it, since the reporter emits one rendered key per row', () => {
      expect(
        deriveAutomationKey(
          declaration({ title: 'adds %i and %i', parametrized: true }),
          VITEST_AT_ROOT,
        ),
      ).toEqual({
        kind: 'key',
        key: 'src/features/cart/cart.test.ts::Cart > adds %i and %i',
        parametrized: true,
      });
    });
  });

  describe('parity with the identity the runs side stores', () => {
    const LONG_TITLE = `handles ${'a very long parametrized title '.repeat(15)}end`;
    const LONG_PATH = `${'nested/'.repeat(40)}cart.test.ts`;

    it.each([
      ['nested describes', ['Cart', 'totals'], 'sums the lines'],
      ['no describe', [], 'adds an item'],
      [
        'XML special characters',
        ['Cart <beta>'],
        'keeps "quotes" & \'apostrophes\'',
      ],
      ['padded titles', ['  Cart '], ' adds an item  '],
      ['a name past the 372-character cap', ['Cart'], LONG_TITLE],
    ])('matches vitest for %s', (_label, describePath, title) => {
      const derived = deriveAutomationKey(
        declaration({ describePath, title }),
        VITEST_AT_ROOT,
      );

      expect(derived).toMatchObject({
        key: ingestedIdentity(
          vitestTestcase(VITEST_AT_ROOT.filePath, describePath, title),
        ),
      });
    });

    it('matches vitest for a file path past the 250-character classname cap', () => {
      const derived = deriveAutomationKey(declaration(), {
        runner: 'vitest',
        filePath: LONG_PATH,
        pathBase: '',
      });

      expect(derived).toMatchObject({
        key: ingestedIdentity(
          vitestTestcase(LONG_PATH, ['Cart'], 'adds an item'),
        ),
      });
    });

    it.each([
      ['nested describes', ['Cart', 'totals'], 'sums the lines'],
      ['no describe', [], 'adds an item'],
      [
        'XML special characters',
        ['Cart <beta>'],
        'keeps "quotes" & \'apostrophes\'',
      ],
      ['a name past the 372-character cap', ['Cart'], LONG_TITLE],
    ])('matches jest-junit for %s', (_label, describePath, title) => {
      const derived = deriveAutomationKey(
        declaration({ describePath, title }),
        {
          runner: 'jest',
        },
      );

      expect(derived).toMatchObject({
        key: ingestedIdentity(jestJunitTestcase(describePath, title)),
      });
    });
  });
});
