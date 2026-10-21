import { matchTargetedCases, readDeclaredFile } from './index';

const CONTENT = [
  "describe('Cart', () => {",
  "  it('adds an item', () => {",
  '    expect(cart.add(item)).toBe(1);',
  '  });',
  "  it('removes an item', () => {",
  '    expect(cart.remove(item)).toBe(0);',
  '  });',
  "  it.each([[1, 1], [2, 2]])('keeps %i as %i', (a, b) => {",
  '    expect(cart.keep(a)).toBe(b);',
  '  });',
  "  it('empties the cart', () => {",
  '    expect(cart.size()).toBe(0);',
  '  });',
  "  it('starts empty', () => {",
  '    expect(cart.size()).toBe(0);',
  '  });',
  '});',
].join('\n');

/** Every declaration of the file, in source order. */
function declarations() {
  const result = readDeclaredFile({
    filePath: 'src/cart.spec.ts',
    content: CONTENT,
    truncated: false,
  });
  if (result.kind !== 'declared') throw new Error(result.reason);
  return result.file.declarations;
}

/** The declarations named, in the order given: the request's targets. */
function targetsNamed(...titles: string[]) {
  const all = declarations();
  return {
    all,
    targets: titles.map((title) => {
      const found = all.find((declaration) => declaration.title === title);
      if (found === undefined) throw new Error(title);
      return found;
    }),
  };
}

function aCase(overrides: {
  automationKey: string;
  targetRef?: string;
  sourceExcerpt?: string;
}) {
  return { sourceExcerpt: 'unrelated text', ...overrides };
}

const titlesOf = (match: {
  matched: readonly { target: { title: string } }[];
}) => match.matched.map(({ target }) => target.title);

describe('matchTargetedCases', () => {
  it('matches each case to the target whose tag it cites', () => {
    const { all, targets } = targetsNamed('adds an item', 'removes an item');
    const match = matchTargetedCases(
      targets,
      all,
      [
        aCase({ automationKey: 'whatever', targetRef: 'T2' }),
        aCase({ automationKey: 'whatever else', targetRef: 'T1' }),
      ],
      CONTENT,
    );

    expect(titlesOf(match)).toEqual(['adds an item', 'removes an item']);
    expect(match.missing).toEqual([]);
    expect(match.dropped).toBe(0);
  });

  it.each([
    ['a jest key', 'Cart removes an item'],
    ['a vitest key', 'src/cart.spec.ts::Cart > removes an item'],
  ])('falls back to %s that names one target', (_label, automationKey) => {
    const { all, targets } = targetsNamed('adds an item', 'removes an item');
    const match = matchTargetedCases(
      targets,
      all,
      [aCase({ automationKey })],
      CONTENT,
    );

    expect(titlesOf(match)).toEqual(['removes an item']);
  });

  it('falls back to the line span of the quoted excerpt', () => {
    const { all, targets } = targetsNamed('removes an item');
    const match = matchTargetedCases(
      targets,
      all,
      [
        aCase({
          automationKey: 'Cart removing',
          sourceExcerpt: 'expect(cart.remove(item)).toBe(0);',
        }),
      ],
      CONTENT,
    );

    expect(titlesOf(match)).toEqual(['removes an item']);
  });

  it('takes one case per row for a table, all citing its tag', () => {
    const { all, targets } = targetsNamed('keeps %i as %i');
    const match = matchTargetedCases(
      targets,
      all,
      [
        aCase({
          automationKey: 'Cart keeps 1 as 1',
          targetRef: 'T1',
          sourceExcerpt: 'expect(cart.keep(a)).toBe(b);',
        }),
        aCase({ automationKey: 'Cart keeps 2 as 2', targetRef: 'T1' }),
      ],
      CONTENT,
    );

    expect(titlesOf(match)).toEqual(['keeps %i as %i', 'keeps %i as %i']);
  });

  it('drops a case whose key names a test it was not asked about', () => {
    const { all, targets } = targetsNamed('removes an item');
    const match = matchTargetedCases(
      targets,
      all,
      [
        aCase({ automationKey: 'Cart adds an item' }),
        aCase({ automationKey: 'Cart removes an item' }),
      ],
      CONTENT,
    );

    expect(titlesOf(match)).toEqual(['removes an item']);
    expect(match.dropped).toBe(1);
  });

  it('drops a case whose tag is contradicted by the test its key names', () => {
    const { all, targets } = targetsNamed('adds an item', 'removes an item');
    const match = matchTargetedCases(
      targets,
      all,
      [aCase({ automationKey: 'Cart empties the cart', targetRef: 'T1' })],
      CONTENT,
    );

    expect(match.matched).toEqual([]);
    expect(match.missing.map(({ title }) => title)).toEqual([
      'adds an item',
      'removes an item',
    ]);
    expect(match.dropped).toBe(1);
  });

  it('drops a case whose tag is contradicted by the only test its excerpt quotes', () => {
    const { all, targets } = targetsNamed('adds an item');
    const match = matchTargetedCases(
      targets,
      all,
      [
        aCase({
          automationKey: 'Cart adding',
          targetRef: 'T1',
          sourceExcerpt: 'expect(cart.remove(item)).toBe(0);',
        }),
      ],
      CONTENT,
    );

    expect(match.matched).toEqual([]);
    expect(match.dropped).toBe(1);
  });

  it('keeps a tag when the quoted line is shared with an unchanged test', () => {
    const { all, targets } = targetsNamed('empties the cart');
    const match = matchTargetedCases(
      targets,
      all,
      [
        aCase({
          automationKey: 'Cart emptying',
          targetRef: 'T1',
          sourceExcerpt: 'expect(cart.size()).toBe(0);',
        }),
      ],
      CONTENT,
    );

    expect(titlesOf(match)).toEqual(['empties the cart']);
  });

  it('drops an untagged case whose quoted line is shared with an unchanged test', () => {
    const { all, targets } = targetsNamed('empties the cart');
    const match = matchTargetedCases(
      targets,
      all,
      [
        aCase({
          automationKey: 'Cart emptying',
          sourceExcerpt: 'expect(cart.size()).toBe(0);',
        }),
      ],
      CONTENT,
    );

    expect(match.matched).toEqual([]);
    expect(match.dropped).toBe(1);
  });

  it('drops an untagged case whose key and excerpt point at different tests', () => {
    const { all, targets } = targetsNamed('adds an item', 'removes an item');
    const match = matchTargetedCases(
      targets,
      all,
      [
        aCase({
          automationKey: 'Cart adds an item',
          sourceExcerpt: 'expect(cart.remove(item)).toBe(0);',
        }),
      ],
      CONTENT,
    );

    expect(match.matched).toEqual([]);
    expect(match.dropped).toBe(1);
  });

  it('never gives a plain test two cases, and ignores a tag two cases cite', () => {
    const { all, targets } = targetsNamed('adds an item', 'removes an item');
    const match = matchTargetedCases(
      targets,
      all,
      [
        aCase({ automationKey: 'adding', targetRef: 'T1' }),
        aCase({ automationKey: 'adding again', targetRef: 'T1' }),
        aCase({ automationKey: 'Cart removes an item' }),
        aCase({ automationKey: 'Cart removes an item' }),
      ],
      CONTENT,
    );

    expect(titlesOf(match)).toEqual(['removes an item']);
    expect(match.dropped).toBe(3);
  });

  it('ignores a tag outside the request', () => {
    const { all, targets } = targetsNamed('adds an item');
    const match = matchTargetedCases(
      targets,
      all,
      [aCase({ automationKey: 'nothing', targetRef: 'T9' })],
      CONTENT,
    );

    expect(match.matched).toEqual([]);
    expect(match.dropped).toBe(1);
  });
});
