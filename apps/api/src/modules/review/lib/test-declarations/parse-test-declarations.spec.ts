import {
  parseTestDeclarations,
  type ParseTestDeclarationsInput,
  type TestDeclaration,
} from './parse-test-declarations';

function parse(
  content: string,
  overrides: Partial<ParseTestDeclarationsInput> = {},
): readonly TestDeclaration[] {
  const result = parseTestDeclarations({
    filePath: 'src/cart.test.ts',
    content,
    ...overrides,
  });
  if (result.kind !== 'parsed') {
    throw new Error(`expected a parsed result, got ${result.kind}`);
  }
  return result.declarations;
}

function only(content: string): TestDeclaration {
  const declarations = parse(content);
  expect(declarations).toHaveLength(1);
  return declarations[0];
}

describe('parseTestDeclarations', () => {
  describe('declarations and describe paths', () => {
    it('reads each it/test with its kind, title and enclosing describe chain, outermost first', () => {
      const declarations = parse(`
describe('Cart', () => {
  describe('totals', () => {
    it('sums the lines', () => {});
  });
  test('starts empty', () => {});
});
test('works without a describe', () => {});
`);

      expect(
        declarations.map(({ kind, title, describePath }) => ({
          kind,
          title,
          describePath,
        })),
      ).toEqual([
        {
          kind: 'it',
          title: 'sums the lines',
          describePath: ['Cart', 'totals'],
        },
        { kind: 'test', title: 'starts empty', describePath: ['Cart'] },
        { kind: 'test', title: 'works without a describe', describePath: [] },
      ]);
    });

    it('treats context and suite as describe scopes', () => {
      const declarations = parse(`
suite('Checkout', () => {
  context('with a coupon', () => {
    it('applies the discount', () => {});
  });
});
`);

      expect(declarations[0].describePath).toEqual([
        'Checkout',
        'with a coupon',
      ]);
    });

    it('returns the declarations in source order', () => {
      const declarations = parse(`
it('first', () => {});
describe('group', () => {
  it('second', () => {});
});
it('third', () => {});
`);

      expect(declarations.map((declaration) => declaration.title)).toEqual([
        'first',
        'second',
        'third',
      ]);
    });

    it('returns no declarations for a file without tests', () => {
      expect(parse('export const total = 1;\n')).toEqual([]);
      expect(parse('')).toEqual([]);
    });
  });

  describe('modifiers', () => {
    it('records the modifiers chained on the declaration, in source order', () => {
      const declarations = parse(`
it.only('a', () => {});
it.skip('b', () => {});
test.todo('c');
it.concurrent('d', () => {});
test.failing('e', () => {});
test.fails('f', () => {});
it.concurrent.only('g', () => {});
test.sequential('h', () => {});
`);

      expect(declarations.map((declaration) => declaration.modifiers)).toEqual([
        ['only'],
        ['skip'],
        ['todo'],
        ['concurrent'],
        ['failing'],
        ['fails'],
        ['concurrent', 'only'],
        ['sequential'],
      ]);
      expect(
        declarations.every((declaration) => !declaration.parametrized),
      ).toBe(true);
    });

    it('maps the x and f aliases to skip and only', () => {
      const declarations = parse(`
xit('a', () => {});
xtest('b', () => {});
fit('c', () => {});
xdescribe('skipped group', () => {
  it('d', () => {});
});
fdescribe('focused group', () => {
  test('e', () => {});
});
`);

      expect(
        declarations.map(({ kind, modifiers, describePath }) => ({
          kind,
          modifiers,
          describePath,
        })),
      ).toEqual([
        { kind: 'it', modifiers: ['skip'], describePath: [] },
        { kind: 'test', modifiers: ['skip'], describePath: [] },
        { kind: 'it', modifiers: ['only'], describePath: [] },
        { kind: 'it', modifiers: [], describePath: ['skipped group'] },
        { kind: 'test', modifiers: [], describePath: ['focused group'] },
      ]);
    });

    it('reads the conditional skipIf and runIf factories', () => {
      const declarations = parse(`
it.skipIf(process.env.CI)('a', () => {});
test.runIf(isLinux)('b', () => {});
`);

      expect(declarations.map((declaration) => declaration.modifiers)).toEqual([
        ['skipIf'],
        ['runIf'],
      ]);
      expect(declarations.map((declaration) => declaration.title)).toEqual([
        'a',
        'b',
      ]);
    });
  });

  describe('parametrized declarations', () => {
    it('reads it.each with an array table as one parametrized declaration with its template title', () => {
      const declaration = only(`
it.each([
  [1, 1, 2],
  [2, 2, 4],
])('adds %i and %i', (a, b, sum) => {
  expect(a + b).toBe(sum);
});
`);

      expect(declaration).toMatchObject({
        kind: 'it',
        title: 'adds %i and %i',
        modifiers: ['each'],
        parametrized: true,
        dynamicTitle: false,
      });
    });

    it('reads test.each with a tagged template table', () => {
      const declaration = only(
        [
          'test.each`',
          '  a    | b    | expected',
          '  ${1} | ${1} | ${2}',
          '  ${2} | ${1} | ${3}',
          "`('returns $expected when $a is added to $b', ({ a, b, expected }) => {",
          '  expect(a + b).toBe(expected);',
          '});',
        ].join('\n'),
      );

      expect(declaration).toMatchObject({
        kind: 'test',
        title: 'returns $expected when $a is added to $b',
        modifiers: ['each'],
        parametrized: true,
      });
    });

    it('reads modifiers chained before each', () => {
      const declarations = parse(`
it.skip.each([1])('a %i', () => {});
it.concurrent.each([1])('b %i', () => {});
it.only.each\`x\${1}\`('c', () => {});
`);

      expect(declarations.map((declaration) => declaration.modifiers)).toEqual([
        ['skip', 'each'],
        ['concurrent', 'each'],
        ['only', 'each'],
      ]);
    });

    it('reads test.for as a parametrized declaration', () => {
      const declaration = only(`
test.for([[1, 2]])('adds %i to %i', ([a, b]) => {
  expect(a + b).toBeGreaterThan(0);
});
`);

      expect(declaration).toMatchObject({
        title: 'adds %i to %i',
        modifiers: ['for'],
        parametrized: true,
      });
    });

    it('marks every declaration under describe.each as parametrized and keeps the template in the path', () => {
      const declarations = parse(`
describe.each([['EUR'], ['USD']])('prices in %s', () => {
  describe('rounding', () => {
    it('rounds half up', () => {});
  });
});
it('stays plain outside the table', () => {});
`);

      expect(declarations[0]).toMatchObject({
        title: 'rounds half up',
        describePath: ['prices in %s', 'rounding'],
        modifiers: [],
        parametrized: true,
      });
      expect(declarations[1].parametrized).toBe(false);
    });

    it('does not count the table call of an each as a declaration of its own', () => {
      expect(
        parse(`
const rows = it.each([[1], [2]]);
const table = describe.each([['a']]);
`),
      ).toEqual([]);
    });
  });

  describe('what is not a declaration', () => {
    it('ignores it/test identifiers that are not called', () => {
      expect(
        parse(`
const alias = it;
expect(test).toBeDefined();
const map = { it: 1, test: 2 };
`),
      ).toEqual([]);
    });

    it('ignores calls on unknown members and on other objects', () => {
      expect(
        parse(`
const myTest = test.extend({ page: async ({}, use) => use(1) });
it.name('x');
describe.foo('y', () => {});
helper.it('z', () => {});
runner.test('w', () => {});
`),
      ).toEqual([]);
    });

    it('ignores a call without a title argument', () => {
      expect(parse('it();\ntest.skip();\n')).toEqual([]);
    });

    it('ignores an it/test mentioned inside a comment or a string', () => {
      expect(
        parse(`
// it('commented out', () => {});
/* test('also commented', () => {}); */
const sample = "it('inside a string', () => {})";
`),
      ).toEqual([]);
    });

    it('does not look for declarations inside a test body, where runners reject them', () => {
      const declarations = parse(`
it('outer', () => {
  it('inner', () => {});
});
`);

      expect(declarations.map((declaration) => declaration.title)).toEqual([
        'outer',
      ]);
    });

    it('reads a test declared inside a helper function with the static scope it is written in', () => {
      const declarations = parse(`
function behavesLikeAList() {
  it('keeps insertion order', () => {});
}
describe('Queue', () => {
  behavesLikeAList();
});
`);

      expect(declarations).toHaveLength(1);
      expect(declarations[0].describePath).toEqual([]);
    });
  });

  describe('titles', () => {
    it('reads a no-substitution template literal as a static title', () => {
      expect(only('it(`adds an item`, () => {});')).toMatchObject({
        title: 'adds an item',
        dynamicTitle: false,
      });
    });

    it('resolves escape sequences the way the runtime title does', () => {
      expect(only("it('it\\'s \\u00e9t\\u00e9', () => {});").title).toBe(
        "it's été",
      );
    });

    it.each([
      [
        'a template with substitutions',
        'it(`adds ${count} items`, () => {});',
        '`adds ${count} items`',
      ],
      ['an identifier', 'it(title, () => {});', 'title'],
      [
        'a concatenation',
        "it('adds ' + 'items', () => {});",
        "'adds ' + 'items'",
      ],
      ['a call', "it(format('adds'), () => {});", "format('adds')"],
    ])(
      'keeps the raw source of %s as a dynamic title',
      (_label, source, raw) => {
        expect(only(source)).toMatchObject({ title: raw, dynamicTitle: true });
      },
    );

    it('flags a dynamic describe title on the declarations under it and keeps its raw source in the path', () => {
      const declaration = only(`
describe(CartService.name, () => {
  it('adds an item', () => {});
});
`);

      expect(declaration).toMatchObject({
        title: 'adds an item',
        dynamicTitle: false,
        describePath: ['CartService.name'],
        dynamicDescribePath: true,
      });
    });

    it('leaves dynamicDescribePath false when every describe title is static', () => {
      expect(
        only(`
describe('Cart', () => {
  it('adds an item', () => {});
});
`).dynamicDescribePath,
      ).toBe(false);
    });
  });

  describe('spans', () => {
    it('reports 1-based start and end lines covering the whole call expression, table included', () => {
      const declarations = parse(
        [
          "import { it } from 'vitest';",
          '',
          'it.each([',
          '  [1],',
          "])('row %i', () => {",
          '  expect(1).toBe(1);',
          '});',
          "it('one line', () => {});",
        ].join('\n'),
      );

      expect(
        declarations.map(({ startLine, endLine }) => ({ startLine, endLine })),
      ).toEqual([
        { startLine: 3, endLine: 7 },
        { startLine: 8, endLine: 8 },
      ]);
    });
  });

  describe('body hash', () => {
    const LF = [
      "describe('Cart', () => {",
      "  it('adds an item', () => {",
      '    cart.add(item);',
      '    expect(cart.size).toBe(1);',
      '  });',
      '});',
    ].join('\n');

    function hashOf(content: string): string {
      return only(content).bodyHash;
    }

    it('is a sha256 hex digest', () => {
      expect(hashOf(LF)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is the same for CRLF and LF line endings', () => {
      expect(hashOf(LF.replace(/\n/g, '\r\n'))).toBe(hashOf(LF));
    });

    it('ignores trailing whitespace on each line', () => {
      expect(hashOf(LF.replace(/;\n/g, ';   \t\n'))).toBe(hashOf(LF));
    });

    it('changes when the body changes', () => {
      expect(hashOf(LF.replace('toBe(1)', 'toBe(2)'))).not.toBe(hashOf(LF));
    });

    it('changes when the title changes, since the title is part of the call', () => {
      expect(hashOf(LF.replace('adds an item', 'adds one item'))).not.toBe(
        hashOf(LF),
      );
    });

    it('changes when a comment is added inside the call, because comments are part of its text', () => {
      expect(
        hashOf(
          LF.replace(
            '    cart.add(item);',
            '    // add it\n    cart.add(item);',
          ),
        ),
      ).not.toBe(hashOf(LF));
    });

    it('does not change when a comment is added above the call, outside its text', () => {
      expect(hashOf(LF.replace("  it('adds", "  // a note\n  it('adds"))).toBe(
        hashOf(LF),
      );
    });

    it('does not change when the enclosing describe or a sibling changes', () => {
      const moved = [
        "describe('Basket', () => {",
        "  it('adds an item', () => {",
        '    cart.add(item);',
        '    expect(cart.size).toBe(1);',
        '  });',
        "  it('removes an item', () => {});",
        '});',
      ].join('\n');

      expect(parse(moved)[0].bodyHash).toBe(hashOf(LF));
    });

    it('changes when the table of an each changes', () => {
      const table = "it.each([[1]])('row %i', () => {});";
      expect(hashOf(table.replace('[[1]]', '[[2]]'))).not.toBe(hashOf(table));
    });
  });

  describe('file kinds', () => {
    it.each([
      ['src/cart.test.ts', "it('a', () => { const n = 1 as number; });"],
      ['src/cart.test.tsx', "it('a', () => { render(<Cart items={[]} />); });"],
      ['src/cart.test.js', "it('a', () => { render(<Cart />); });"],
      ['src/cart.test.jsx', "it('a', () => { render(<Cart />); });"],
      ['src/cart.test.mjs', "import { it } from 'vitest';\nit('a', () => {});"],
      [
        'src/cart.test.cjs',
        "const { it } = require('vitest');\nit('a', () => {});",
      ],
      ['src/cart.test.mts', "it('a', () => { const n = 1 as number; });"],
      ['src/cart.test.cts', "it('a', () => { const n = <number>1; });"],
      ['src/CART.TEST.TS', "it('a', () => {});"],
    ])('parses a %s file', (filePath, content) => {
      expect(parse(content, { filePath }).map((d) => d.title)).toEqual(['a']);
    });

    it.each([
      'tests/test_cart.py',
      'src/test/java/CartTest.java',
      'README.md',
      'src/cart',
      'src/cart.test.ts.snap',
    ])('returns unsupported for %s', (filePath) => {
      expect(
        parseTestDeclarations({ filePath, content: "it('a', () => {});" }),
      ).toEqual({ kind: 'unsupported', reason: 'unsupported-extension' });
    });

    it('returns a syntax error result instead of throwing on a file that does not parse', () => {
      const result = parseTestDeclarations({
        filePath: 'src/cart.test.ts',
        content: "describe('Cart', () => {\n  it('adds', () => {\n",
      });

      expect(result).toMatchObject({ kind: 'error', reason: 'syntax-error' });
      if (result.kind === 'error') {
        expect(result.message).toMatch(/^line \d+: /);
      }
    });

    it('returns a syntax error for JSX in a .ts file', () => {
      expect(
        parseTestDeclarations({
          filePath: 'src/cart.test.ts',
          content: "it('a', () => { render(<Cart />); });",
        }).kind,
      ).toBe('error');
    });

    it('reads TypeScript syntax in a .js file, since only the parser grammar is checked', () => {
      expect(
        parse("it('a', () => { const n = 1 as number; });", {
          filePath: 'src/cart.test.js',
        }).map((declaration) => declaration.title),
      ).toEqual(['a']);
    });
  });
});
