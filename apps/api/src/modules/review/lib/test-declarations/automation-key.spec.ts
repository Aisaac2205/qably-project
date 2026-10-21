import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { resolveCaseIdentityKey } from '../../../runs/lib/case-identity';
import { parseJunitXml } from '../../../runs/lib/parse-junit-xml';
import { ingestRunSchema } from '../../../runs/runs.schemas';
import {
  deriveAutomationKey,
  type AutomationKeyDeclaration,
} from './automation-key';
import { storedIdentityKey } from './stored-identity';

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

/**
 * The key POST /runs/ingest/junit stores for the first testcase of a report:
 * the XML goes through `parseJunitXml`, the controller's `ingestRunSchema`
 * and `resolveCaseIdentityKey`, as it does in production. Undefined when the
 * schema rejects the report.
 */
function ingestedIdentity(xml: string): string | undefined {
  const parsed = ingestRunSchema.safeParse({
    externalId: 'run-1',
    source: 'github_actions',
    suiteName: 'suite',
    name: 'run',
    cases: parseJunitXml(xml).cases,
  });
  if (!parsed.success) return undefined;

  const [reported] = parsed.data.cases;
  return resolveCaseIdentityKey({
    name: reported.name,
    className: reported.className,
  });
}

// The real jest-junit reporter (a devDependency of this package), driven with
// its default options, so its template filling is what produces the XML.
const requireFromJestJunit = createRequire(
  realpathSync(require.resolve('jest-junit')),
);
const buildJsonResults = requireFromJestJunit('./utils/buildJsonResults') as (
  report: unknown,
  appDirectory: string,
  options: Record<string, string>,
) => unknown;
const { DEFAULT_OPTIONS } = requireFromJestJunit('./constants/index') as {
  DEFAULT_OPTIONS: Record<string, string>;
};
const toXml = requireFromJestJunit('xml') as (
  data: unknown,
  options: { declaration: boolean },
) => string;

function jestJunitXml(
  describePath: readonly string[],
  title: string,
  displayName?: string,
): string {
  const appDirectory = process.cwd();
  const report = {
    startTime: 0,
    testResults: [
      {
        testFilePath: resolve(appDirectory, 'src/cart.spec.ts'),
        displayName,
        numFailingTests: 0,
        numPassingTests: 1,
        numPendingTests: 0,
        perfStats: { start: 0, end: 1 },
        testExecError: null,
        testResults: [
          {
            ancestorTitles: [...describePath],
            title,
            duration: 1,
            status: 'passed',
            failureMessages: [],
          },
        ],
      },
    ],
  };

  return toXml(buildJsonResults(report, appDirectory, { ...DEFAULT_OPTIONS }), {
    declaration: true,
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// vitest 4 junit reporter (dist/chunks/index.*.js, JUnitReporter): classname
// is the file path relative to the vitest root, name is the describe chain and
// the title joined by " > ", both escaped with escapeXML.
function vitestXml(
  relativePath: string,
  describePath: readonly string[],
  title: string,
): string {
  const name = [...describePath, title].join(' > ');
  return `<?xml version="1.0" encoding="UTF-8" ?>
<testsuites name="vitest tests">
  <testsuite name="${escapeXml(relativePath)}" tests="1">
    <testcase classname="${escapeXml(relativePath)}" name="${escapeXml(name)}" time="0.001"/>
  </testsuite>
</testsuites>`;
}

const LONG_TITLE = `handles ${'a very long parametrized title '.repeat(15)}end`;
const LONG_PATH = `${'nested/'.repeat(40)}cart.test.ts`;
// "Cart " plus 366 characters puts a space at character 372, where the cut
// falls, so the stored name is trimmed again after it.
const CUT_ON_A_SPACE = `${'a'.repeat(366)} rest of the title`;
// 300 code points, under the 372-code-point cut, but 600 UTF-16 code units,
// past the schema maximum: the ingestion rejects the report.
const ASTRAL_TITLE = '\u{1F600}'.repeat(300);

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

    it('drops the characters vitest strips from XML attributes', () => {
      expect(
        deriveAutomationKey(
          declaration({ title: 'adds\u0001 an\u001f item�\u0080' }),
          VITEST_AT_ROOT,
        ),
      ).toMatchObject({
        key: 'src/features/cart/cart.test.ts::Cart > adds an item',
      });
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

    it('fills a literal {displayName} in a title with the display name, as jest-junit does last', () => {
      const title = 'reports {displayName}';

      expect(
        deriveAutomationKey(declaration({ title }), {
          runner: 'jest',
          displayName: 'api',
        }),
      ).toMatchObject({ key: 'Cart reports api' });
      expect(
        deriveAutomationKey(declaration({ title }), { runner: 'jest' }),
      ).toMatchObject({ key: 'Cart reports undefined' });
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

    it.each([[''], ['   ']])(
      'reports the empty title %j as unavailable',
      (title) => {
        expect(
          deriveAutomationKey(declaration({ title }), { runner: 'jest' }),
        ).toEqual({ kind: 'unavailable', reason: 'empty-title' });
        expect(
          deriveAutomationKey(declaration({ title }), VITEST_AT_ROOT),
        ).toEqual({ kind: 'unavailable', reason: 'empty-title' });
      },
    );

    it('reports a name the ingestion schema rejects as not ingestible', () => {
      expect(
        deriveAutomationKey(declaration({ title: ASTRAL_TITLE }), {
          runner: 'jest',
        }),
      ).toEqual({ kind: 'unavailable', reason: 'not-ingestible' });
      expect(
        deriveAutomationKey(
          declaration({ title: ASTRAL_TITLE }),
          VITEST_AT_ROOT,
        ),
      ).toEqual({ kind: 'unavailable', reason: 'not-ingestible' });
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

  describe('parity with the key POST /runs/ingest/junit stores', () => {
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
      ['a cut that ends on a space', ['Cart'], CUT_ON_A_SPACE],
    ])('matches vitest for %s', (_label, describePath, title) => {
      const derived = deriveAutomationKey(
        declaration({ describePath, title }),
        VITEST_AT_ROOT,
      );

      expect(derived).toMatchObject({
        key: ingestedIdentity(
          vitestXml(VITEST_AT_ROOT.filePath, describePath, title),
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
        key: ingestedIdentity(vitestXml(LONG_PATH, ['Cart'], 'adds an item')),
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
      [
        '"$" patterns in the chain and the title',
        ['Cart $&'],
        "costs $$5 $' more",
      ],
      ['a literal {title} in the describe chain', ['Cart {title}'], 'adds'],
      ['a name past the 372-character cap', ['Cart'], LONG_TITLE],
      ['a cut that ends on a space', ['Cart'], CUT_ON_A_SPACE],
    ])(
      'matches the real jest-junit reporter for %s',
      (_label, describePath, title) => {
        const derived = deriveAutomationKey(
          declaration({ describePath, title }),
          { runner: 'jest' },
        );

        expect(derived).toEqual({
          kind: 'key',
          key: ingestedIdentity(jestJunitXml(describePath, title)),
          parametrized: false,
        });
      },
    );

    it('matches the real jest-junit reporter for a {displayName} in a title', () => {
      const title = 'reports {displayName}';

      expect(
        deriveAutomationKey(declaration({ title }), {
          runner: 'jest',
          displayName: 'api',
        }),
      ).toMatchObject({
        key: ingestedIdentity(jestJunitXml(['Cart'], title, 'api')),
      });
      expect(
        deriveAutomationKey(declaration({ title }), { runner: 'jest' }),
      ).toMatchObject({ key: ingestedIdentity(jestJunitXml(['Cart'], title)) });
    });

    it('agrees with the ingestion that a name past the schema maximum stores no key', () => {
      expect(ingestedIdentity(jestJunitXml(['Cart'], ASTRAL_TITLE))).toBe(
        undefined,
      );
      expect(
        ingestedIdentity(
          vitestXml(VITEST_AT_ROOT.filePath, ['Cart'], ASTRAL_TITLE),
        ),
      ).toBe(undefined);
    });
  });
});

describe('storedIdentityKey', () => {
  it('names a testcase without a name by its classname, as parseJunitXml does', () => {
    expect(storedIdentityKey({ name: '  ', className: 'Cart adds' })).toBe(
      'Cart adds',
    );
  });

  it('returns undefined when neither attribute has text', () => {
    expect(storedIdentityKey({ name: '', className: ' ' })).toBe(undefined);
  });

  it('drops an empty classname instead of composing with it', () => {
    expect(storedIdentityKey({ name: 'adds', className: '' })).toBe('adds');
  });

  it('returns undefined for a classname past the schema maximum', () => {
    expect(
      storedIdentityKey({ name: 'adds', className: '\u{1F600}'.repeat(200) }),
    ).toBe(undefined);
  });
});
