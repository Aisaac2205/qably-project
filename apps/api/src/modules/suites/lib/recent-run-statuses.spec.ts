import {
  groupStatusesBySuite,
  readRecentRunStatuses,
  recentRunStatusesSql,
  type RecentRunStatusRow,
} from './recent-run-statuses';

function normalized(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

describe('recentRunStatusesSql', () => {
  it('reads every window with one statement that joins each suite to its own latest runs', () => {
    const text = normalized(
      recentRunStatusesSql('org-1', ['suite-1', 'suite-2']).text,
    );

    expect(text).toContain('FROM "suite" s CROSS JOIN LATERAL (');
    expect(text).toContain('FROM "run" r WHERE r."suiteId" = s.id');
    expect(text).toMatch(/LIMIT \$1\b/);
  });

  it('never ranks the whole run history', () => {
    const text = recentRunStatusesSql('org-1', ['suite-1']).text;

    expect(text).not.toMatch(/ROW_NUMBER/i);
    expect(text).not.toMatch(/PARTITION BY/i);
  });

  it('binds the window of 10, then the organization, then the suite ids', () => {
    const sql = recentRunStatusesSql('org-1', [
      'suite-1',
      'suite-2',
      'suite-3',
    ]);

    expect(sql.values).toEqual([10, 'org-1', 'suite-1', 'suite-2', 'suite-3']);
    expect(normalized(sql.text)).toContain('s."organizationId" = $2');
    expect(normalized(sql.text)).toContain('s.id IN ($3,$4,$5)');
  });

  it('binds a different organization and a single suite the same way', () => {
    const sql = recentRunStatusesSql('org-77', ['only-suite']);

    expect(sql.values).toEqual([10, 'org-77', 'only-suite']);
    expect(normalized(sql.text)).toContain('s."organizationId" = $2');
    expect(normalized(sql.text)).toContain('s.id IN ($3)');
  });

  it('breaks startedAt ties by id both inside the window and in the outer order', () => {
    const text = normalized(recentRunStatusesSql('org-1', ['suite-1']).text);

    expect(text).toContain('ORDER BY r."startedAt" DESC, r.id DESC LIMIT');
    expect(text).toContain('ORDER BY s.id ASC, w."startedAt" DESC, w.id DESC');
  });

  it('keeps quotes and comment markers in ids out of the statement text', () => {
    const hostile = `x'; DROP TABLE "run"; --`;
    const sql = recentRunStatusesSql(`o'--`, [hostile, 'suite-2']);

    expect(sql.text).not.toContain('DROP');
    expect(sql.text).not.toContain(`o'--`);
    expect(sql.values).toEqual([10, `o'--`, hostile, 'suite-2']);
  });
});

describe('groupStatusesBySuite', () => {
  it('turns newest-first rows into oldest-first statuses per suite', () => {
    const rows: RecentRunStatusRow[] = [
      { suiteId: 'suite-1', status: 'fail' },
      { suiteId: 'suite-1', status: 'pass' },
      { suiteId: 'suite-1', status: 'pass' },
      { suiteId: 'suite-1', status: 'pass' },
      { suiteId: 'suite-1', status: 'pass' },
      { suiteId: 'suite-1', status: 'pass' },
      { suiteId: 'suite-1', status: 'pass' },
    ];

    expect(groupStatusesBySuite(rows).get('suite-1')).toEqual([
      'pass',
      'pass',
      'pass',
      'pass',
      'pass',
      'pass',
      'fail',
    ]);
  });

  it('keeps each suite on its own and in its own order', () => {
    const rows: RecentRunStatusRow[] = [
      { suiteId: 'suite-1', status: 'running' },
      { suiteId: 'suite-1', status: 'pass' },
      { suiteId: 'suite-2', status: 'fail' },
      { suiteId: 'suite-2', status: 'pending' },
      { suiteId: 'suite-2', status: 'pass' },
    ];

    const grouped = groupStatusesBySuite(rows);

    expect(grouped.get('suite-1')).toEqual(['pass', 'running']);
    expect(grouped.get('suite-2')).toEqual(['pass', 'pending', 'fail']);
    expect(grouped.size).toBe(2);
  });

  it('reverses a pair of rows so the first one the statement returns ends up last', () => {
    const rowsAsOrderedBySql: RecentRunStatusRow[] = [
      { suiteId: 'suite-1', status: 'fail' },
      { suiteId: 'suite-1', status: 'pass' },
    ];

    expect(groupStatusesBySuite(rowsAsOrderedBySql).get('suite-1')).toEqual([
      'pass',
      'fail',
    ]);
  });

  it('leaves a suite without runs out of the result', () => {
    const grouped = groupStatusesBySuite([
      { suiteId: 'suite-1', status: 'pass' },
    ]);

    expect(grouped.has('suite-1')).toBe(true);
    expect(grouped.has('suite-without-runs')).toBe(false);
    expect(grouped.get('suite-without-runs')).toBeUndefined();
  });

  it('does not change the rows it receives', () => {
    const rows: RecentRunStatusRow[] = [
      { suiteId: 'suite-1', status: 'fail' },
      { suiteId: 'suite-1', status: 'pass' },
    ];

    groupStatusesBySuite(rows);

    expect(rows.map((row) => row.status)).toEqual(['fail', 'pass']);
  });
});

describe('readRecentRunStatuses', () => {
  it('runs the window statement once and groups the rows it returns', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      { suiteId: 'suite-1', status: 'fail' },
      { suiteId: 'suite-1', status: 'pass' },
      { suiteId: 'suite-2', status: 'pass' },
    ]);

    const windows = await readRecentRunStatuses(
      { $queryRaw: queryRaw },
      'org-1',
      ['suite-1', 'suite-2', 'suite-3'],
    );

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(
      (queryRaw.mock.calls[0] as [{ values: unknown[] }])[0].values,
    ).toEqual([10, 'org-1', 'suite-1', 'suite-2', 'suite-3']);
    expect(windows.get('suite-1')).toEqual(['pass', 'fail']);
    expect(windows.get('suite-2')).toEqual(['pass']);
    expect(windows.has('suite-3')).toBe(false);
  });

  it('issues the same single read for one suite and for a hundred', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const hundred = Array.from(
      { length: 100 },
      (_value, index) => `s-${index}`,
    );

    await readRecentRunStatuses({ $queryRaw: queryRaw }, 'org-1', ['s-0']);
    expect(queryRaw).toHaveBeenCalledTimes(1);

    await readRecentRunStatuses({ $queryRaw: queryRaw }, 'org-1', hundred);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('does not query when there are no suite ids', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValue([{ suiteId: 'suite-1', status: 'pass' }]);

    const windows = await readRecentRunStatuses(
      { $queryRaw: queryRaw },
      'org-1',
      [],
    );

    expect(queryRaw).not.toHaveBeenCalled();
    expect(windows.size).toBe(0);
  });
});
