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
  '});',
].join('\n');

function targets() {
  const result = readDeclaredFile({
    filePath: 'src/cart.spec.ts',
    content: CONTENT,
    truncated: false,
  });
  if (result.kind !== 'declared') throw new Error(result.reason);
  return result.file.declarations;
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
    const all = targets();
    const match = matchTargetedCases(
      all,
      [
        aCase({ automationKey: 'whatever', targetRef: 'T2' }),
        aCase({ automationKey: 'whatever else', targetRef: 'T1' }),
      ],
      CONTENT,
    );

    expect(titlesOf(match)).toEqual(['adds an item', 'removes an item']);
    expect(match.missing.map(({ title }) => title)).toEqual(['keeps %i as %i']);
    expect(match.dropped).toBe(0);
  });

  it.each([
    ['a jest key', 'Cart removes an item'],
    ['a vitest key', 'src/cart.spec.ts::Cart > removes an item'],
  ])('falls back to %s that names one target', (_label, automationKey) => {
    const match = matchTargetedCases(
      targets(),
      [aCase({ automationKey })],
      CONTENT,
    );

    expect(titlesOf(match)).toEqual(['removes an item']);
  });

  it('falls back to the line span of the quoted excerpt', () => {
    const match = matchTargetedCases(
      targets(),
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
    const match = matchTargetedCases(
      targets(),
      [
        aCase({ automationKey: 'Cart keeps 1 as 1', targetRef: 'T3' }),
        aCase({ automationKey: 'Cart keeps 2 as 2', targetRef: 'T3' }),
      ],
      CONTENT,
    );

    expect(titlesOf(match)).toEqual(['keeps %i as %i', 'keeps %i as %i']);
  });

  it('drops a case that describes no target, such as an unchanged test', () => {
    const [, removes] = targets();
    const match = matchTargetedCases(
      [removes],
      [
        aCase({ automationKey: 'Cart adds an item' }),
        aCase({ automationKey: 'Cart removes an item' }),
      ],
      CONTENT,
    );

    expect(titlesOf(match)).toEqual(['removes an item']);
    expect(match.dropped).toBe(1);
  });

  it('never gives a plain test two cases, and ignores a tag two cases cite', () => {
    const match = matchTargetedCases(
      targets(),
      [
        aCase({ automationKey: 'Cart adds an item', targetRef: 'T1' }),
        aCase({ automationKey: 'Cart removes an item', targetRef: 'T1' }),
        aCase({ automationKey: 'Cart adds an item' }),
      ],
      CONTENT,
    );

    expect(titlesOf(match)).toEqual(['adds an item', 'removes an item']);
    expect(match.dropped).toBe(1);
  });

  it('ignores a tag outside the request', () => {
    const match = matchTargetedCases(
      targets(),
      [aCase({ automationKey: 'nothing', targetRef: 'T9' })],
      CONTENT,
    );

    expect(match.matched).toEqual([]);
    expect(match.dropped).toBe(1);
  });
});
