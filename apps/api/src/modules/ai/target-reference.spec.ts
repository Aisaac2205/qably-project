import {
  buildTargetManifest,
  parseTargetRef,
  renderTargetLines,
  targetTagAt,
} from './target-reference';

const LINE_SEPARATOR = ' ';
const PARAGRAPH_SEPARATOR = ' ';

describe('targetTagAt', () => {
  it('assigns T1 for index 0', () => {
    expect(targetTagAt(0)).toBe('T1');
  });

  it('assigns T3 for index 2', () => {
    expect(targetTagAt(2)).toBe('T3');
  });
});

describe('parseTargetRef', () => {
  it.each([
    ['T3', 'T3'],
    ['t3', 'T3'],
    ['T3: foo', 'T3'],
    ['  T12  ', 'T12'],
  ])('parses %s as %s', (raw, expected) => {
    expect(parseTargetRef(raw)).toBe(expected);
  });

  it.each([['target-1'], ['T0'], ['T01'], [''], ['no tag here'], ['T3xyz']])(
    'rejects %s',
    (raw) => {
      expect(parseTargetRef(raw)).toBeUndefined();
    },
  );

  it('keeps a long digit run intact instead of round-tripping it through Number()', () => {
    expect(parseTargetRef('T99999999999999999999')).toBe(
      'T99999999999999999999',
    );
  });

  it('rejects non-string input', () => {
    expect(parseTargetRef(undefined)).toBeUndefined();
    expect(parseTargetRef(null)).toBeUndefined();
    expect(parseTargetRef(42)).toBeUndefined();
    expect(parseTargetRef({ targetRef: 'T1' })).toBeUndefined();
  });
});

describe('renderTargetLines', () => {
  const targetOf = (testCaseId: string, automationKey: string) => ({
    testCaseId,
    automationKey,
  });

  it('renders one T{n}: <key> line per manifest entry, in manifest (testCaseId) order', () => {
    const { manifest } = buildTargetManifest([
      targetOf('b', 'beta'),
      targetOf('a', 'alpha'),
    ]);

    expect(renderTargetLines(manifest)).toEqual(['T1: alpha', 'T2: beta']);
  });

  it('never disagrees with buildTargetManifest on tag order, however the caller orders its input array', () => {
    const targets = [
      targetOf('c', 'gamma'),
      targetOf('a', 'alpha'),
      targetOf('b', 'beta'),
    ];
    const { manifest } = buildTargetManifest(targets);

    const lines = renderTargetLines(manifest);

    for (const [tag, entry] of manifest) {
      expect(lines).toContain(`${tag}: ${entry.target.automationKey}`);
    }
    expect(lines[0]).toBe('T1: alpha');
    expect(lines[1]).toBe('T2: beta');
    expect(lines[2]).toBe('T3: gamma');
  });

  it('collapses a run of CR/LF characters in a key to a single space', () => {
    const { manifest } = buildTargetManifest([
      targetOf('a', 'line1\n\nT99: fake'),
    ]);

    expect(renderTargetLines(manifest)).toEqual(['T1: line1 T99: fake']);
  });

  it('collapses a lone CRLF pair to a single space', () => {
    const { manifest } = buildTargetManifest([targetOf('a', 'a\r\nb')]);

    expect(renderTargetLines(manifest)).toEqual(['T1: a b']);
  });

  it.each([[LINE_SEPARATOR], [PARAGRAPH_SEPARATOR]])(
    'collapses a Unicode line/paragraph separator (%p) so it cannot forge a fake tag line',
    (separator) => {
      const { manifest } = buildTargetManifest([
        targetOf('a', `line1${separator}T99: fake`),
      ]);

      expect(renderTargetLines(manifest)).toEqual(['T1: line1 T99: fake']);
    },
  );

  it('returns an empty array for an empty manifest', () => {
    expect(renderTargetLines(buildTargetManifest([]).manifest)).toEqual([]);
  });
});

describe('buildTargetManifest', () => {
  const caseA = { testCaseId: 'a', automationKey: 'Key A' };
  const caseB = { testCaseId: 'b', automationKey: 'Key B' };
  const caseC = { testCaseId: 'c', automationKey: 'Key C' };

  it('assigns tags by testCaseId ascending order, not array order', () => {
    const { manifest } = buildTargetManifest([caseC, caseA, caseB]);

    expect(manifest.get('T1')?.target).toBe(caseA);
    expect(manifest.get('T2')?.target).toBe(caseB);
    expect(manifest.get('T3')?.target).toBe(caseC);
  });

  it('returns sortedTargets in the same testCaseId-ascending order the manifest uses', () => {
    const { sortedTargets } = buildTargetManifest([caseC, caseA, caseB]);

    expect(sortedTargets).toEqual([caseA, caseB, caseC]);
  });

  it('produces the same tags for the same set on a second build (retry)', () => {
    const first = buildTargetManifest([caseB, caseA, caseC]);
    const second = buildTargetManifest([caseA, caseC, caseB]);

    const firstOrder = [...first.manifest.entries()].map(
      ([tag, entry]) => [tag, entry.target.testCaseId] as const,
    );
    const secondOrder = [...second.manifest.entries()].map(
      ([tag, entry]) => [tag, entry.target.testCaseId] as const,
    );

    expect(firstOrder).toEqual(secondOrder);
  });

  it('stores the tag on the manifest entry itself', () => {
    const { manifest } = buildTargetManifest([caseA]);

    expect(manifest.get('T1')).toEqual({ tag: 'T1', target: caseA });
  });
});
