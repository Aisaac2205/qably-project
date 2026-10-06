import {
  countCasesBySuite,
  readSuiteCaseCounts,
  type SuiteCaseCountRow,
} from './suite-case-counts';

function group(suiteId: string, cases: number): SuiteCaseCountRow {
  return { suiteId, _count: { _all: cases } };
}

describe('countCasesBySuite', () => {
  it('maps every group to the number of cases of its suite', () => {
    const counts = countCasesBySuite([
      group('suite-1', 3),
      group('suite-2', 12),
    ]);

    expect(counts.get('suite-1')).toBe(3);
    expect(counts.get('suite-2')).toBe(12);
    expect(counts.size).toBe(2);
  });

  it('leaves a suite that has no group out of the map', () => {
    const counts = countCasesBySuite([group('suite-1', 1)]);

    expect(counts.has('suite-2')).toBe(false);
    expect(counts.get('suite-2')).toBeUndefined();
  });
});

describe('readSuiteCaseCounts', () => {
  it.each([[['suite-1']], [['suite-1', 'suite-2', 'suite-3']]])(
    'groups the cases of exactly the given suites %j in one read',
    async (suiteIds) => {
      const groupBy = jest.fn().mockResolvedValue([]);

      await readSuiteCaseCounts({ testCase: { groupBy } }, suiteIds);

      expect(groupBy).toHaveBeenCalledTimes(1);
      expect(groupBy).toHaveBeenCalledWith({
        by: ['suiteId'],
        where: { suiteId: { in: suiteIds } },
        _count: { _all: true },
      });
    },
  );

  it('returns the counts of the groups it reads and nothing for a suite without cases', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValue([group('suite-3', 12), group('suite-1', 3)]);

    const counts = await readSuiteCaseCounts({ testCase: { groupBy } }, [
      'suite-1',
      'suite-2',
      'suite-3',
    ]);

    expect(counts.get('suite-1')).toBe(3);
    expect(counts.get('suite-3')).toBe(12);
    expect(counts.has('suite-2')).toBe(false);
  });

  it('issues the same single read for one suite and for a hundred', async () => {
    const groupBy = jest.fn().mockResolvedValue([]);
    const hundred = Array.from(
      { length: 100 },
      (_value, index) => `suite-${index}`,
    );

    await readSuiteCaseCounts({ testCase: { groupBy } }, ['suite-0']);
    expect(groupBy).toHaveBeenCalledTimes(1);

    await readSuiteCaseCounts({ testCase: { groupBy } }, hundred);
    expect(groupBy).toHaveBeenCalledTimes(2);
  });

  it('does not read when there are no suite ids', async () => {
    const groupBy = jest.fn().mockResolvedValue([group('suite-1', 4)]);

    const counts = await readSuiteCaseCounts({ testCase: { groupBy } }, []);

    expect(groupBy).not.toHaveBeenCalled();
    expect(counts.size).toBe(0);
  });
});
