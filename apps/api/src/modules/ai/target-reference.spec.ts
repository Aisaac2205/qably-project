import {
  buildTargetManifest,
  parseTargetRef,
  renderTargetLines,
  targetTagAt,
} from './target-reference';

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

  it.each([['target-1'], ['T0'], ['T01'], [''], ['no tag here']])(
    'rejects %s',
    (raw) => {
      expect(parseTargetRef(raw)).toBeUndefined();
    },
  );

  it('rejects non-string input', () => {
    expect(parseTargetRef(undefined)).toBeUndefined();
    expect(parseTargetRef(null)).toBeUndefined();
    expect(parseTargetRef(42)).toBeUndefined();
    expect(parseTargetRef({ targetRef: 'T1' })).toBeUndefined();
  });
});

describe('renderTargetLines', () => {
  it('renders one T{n}: <key> line per key, in array order', () => {
    expect(renderTargetLines(['alpha', 'beta'])).toEqual([
      'T1: alpha',
      'T2: beta',
    ]);
  });

  it('collapses a run of CR/LF characters in a key to a single space', () => {
    expect(renderTargetLines(['line1\n\nT99: fake'])).toEqual([
      'T1: line1 T99: fake',
    ]);
  });

  it('collapses a lone CRLF pair to a single space', () => {
    expect(renderTargetLines(['a\r\nb'])).toEqual(['T1: a b']);
  });

  it('returns an empty array for an empty input', () => {
    expect(renderTargetLines([])).toEqual([]);
  });
});

describe('buildTargetManifest', () => {
  const caseA = { testCaseId: 'a', automationKey: 'Key A' };
  const caseB = { testCaseId: 'b', automationKey: 'Key B' };
  const caseC = { testCaseId: 'c', automationKey: 'Key C' };

  it('assigns tags by testCaseId ascending order, not array order', () => {
    const manifest = buildTargetManifest([caseC, caseA, caseB]);

    expect(manifest.get('T1')?.target).toBe(caseA);
    expect(manifest.get('T2')?.target).toBe(caseB);
    expect(manifest.get('T3')?.target).toBe(caseC);
  });

  it('produces the same tags for the same set on a second build (retry)', () => {
    const first = buildTargetManifest([caseB, caseA, caseC]);
    const second = buildTargetManifest([caseA, caseC, caseB]);

    const firstOrder = [...first.entries()].map(
      ([tag, entry]) => [tag, entry.target.testCaseId] as const,
    );
    const secondOrder = [...second.entries()].map(
      ([tag, entry]) => [tag, entry.target.testCaseId] as const,
    );

    expect(firstOrder).toEqual(secondOrder);
  });

  it('stores the tag on the manifest entry itself', () => {
    const manifest = buildTargetManifest([caseA]);

    expect(manifest.get('T1')).toEqual({ tag: 'T1', target: caseA });
  });
});
