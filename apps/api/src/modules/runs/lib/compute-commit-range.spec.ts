import { createHash } from 'node:crypto';
import {
  DEFAULT_MAX_RANGE_COMMITS,
  computeCommitRange,
  type CommitRangeCommit,
  type CommitRangeEvent,
} from './compute-commit-range';

/** Realistic lowercase 40-hex sha, stable per label and distinct in its first 7 characters. */
function sha(label: string): string {
  return createHash('sha1').update(label).digest('hex');
}

interface PushSpec {
  id: string;
  /** Hours after 2026-05-01T00:00Z, or an explicit Date or ISO string. */
  at: number | Date | string;
  /** Commit labels, oldest first. */
  commits: readonly string[];
  /** Label of the tip before the push; null (default) is a new ref. */
  before?: string | null;
  /** Tip label for a push that reports no commits. */
  tip?: string;
  branch?: string;
  forced?: boolean;
  truncated?: boolean;
  kind?: CommitRangeEvent['kind'];
}

function commit(label: string, position: number): CommitRangeCommit {
  return {
    sha: sha(label),
    position,
    message: `change ${label}`,
    author: 'dev@acme.test',
    committedAt: '2026-05-01T09:30:00.000Z',
    url: `https://github.com/acme/app/commit/${sha(label)}`,
  };
}

function push(spec: PushSpec): CommitRangeEvent {
  const tipLabel = spec.commits[spec.commits.length - 1] ?? spec.tip ?? 'tip';
  return {
    id: spec.id,
    kind: spec.kind ?? 'PUSH',
    branch: spec.branch ?? 'main',
    commitSha: sha(tipLabel),
    beforeSha: spec.before == null ? null : sha(spec.before),
    forced: spec.forced ?? false,
    commitsTruncated: spec.truncated ?? false,
    receivedAt:
      typeof spec.at === 'number'
        ? new Date(Date.UTC(2026, 4, 1, spec.at)).toISOString()
        : spec.at,
    commits: spec.commits.map((label, index) => commit(label, index)),
  };
}

function shasOf(result: ReturnType<typeof computeCommitRange>): string[] {
  if (result.kind !== 'range') {
    throw new Error(`expected a range, got ${JSON.stringify(result)}`);
  }
  return result.commits.map((entry) => entry.sha);
}

function labelsToShas(...labels: string[]): string[] {
  return labels.map(sha);
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map(
      (rest) => [item, ...rest],
    ),
  );
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

describe('computeCommitRange', () => {
  describe('missing or equal run shas', () => {
    it.each<[string, string | null | undefined, string | null | undefined]>([
      ['base is null', null, sha('h')],
      ['base is undefined', undefined, sha('h')],
      ['base is blank', '   ', sha('h')],
      ['head is null', sha('b'), null],
      ['head is empty', sha('b'), ''],
      ['both are missing', null, undefined],
    ])('reports no_commit_reported when %s', (_name, baseSha, headSha) => {
      const events = [push({ id: 'e1', at: 1, commits: ['h'], before: 'b' })];

      expect(computeCommitRange({ baseSha, headSha, events })).toEqual({
        kind: 'unknown',
        reason: 'no_commit_reported',
      });
    });

    it('checks for missing shas before it looks at the connection', () => {
      expect(
        computeCommitRange({ baseSha: null, headSha: sha('h'), events: null }),
      ).toEqual({ kind: 'unknown', reason: 'no_commit_reported' });
    });

    it('reports same_commit for equal shas without needing a connection', () => {
      expect(
        computeCommitRange({
          baseSha: sha('a'),
          headSha: sha('a'),
          events: null,
        }),
      ).toEqual({ kind: 'same_commit', sha: sha('a') });
    });

    it('compares shas ignoring case and surrounding whitespace', () => {
      expect(
        computeCommitRange({
          baseSha: ` ${sha('a').toUpperCase()} `,
          headSha: sha('a'),
          events: [],
        }),
      ).toEqual({ kind: 'same_commit', sha: sha('a') });
    });

    it('treats a 7-character prefix as the same commit and returns the full sha', () => {
      const short = sha('a').slice(0, 7);

      expect(
        computeCommitRange({ baseSha: short, headSha: sha('a'), events: null }),
      ).toEqual({ kind: 'same_commit', sha: sha('a') });
      expect(
        computeCommitRange({ baseSha: sha('a'), headSha: short, events: null }),
      ).toEqual({ kind: 'same_commit', sha: sha('a') });
    });

    it('does not treat a 6-character prefix as the same commit', () => {
      const tooShort = sha('a').slice(0, 6);

      expect(
        computeCommitRange({
          baseSha: tooShort,
          headSha: sha('a'),
          events: null,
        }),
      ).toEqual({ kind: 'unknown', reason: 'no_repository_connected' });
    });

    it('does not treat two different shas as the same commit', () => {
      expect(
        computeCommitRange({
          baseSha: sha('a'),
          headSha: sha('b'),
          events: null,
        }),
      ).toEqual({ kind: 'unknown', reason: 'no_repository_connected' });
    });
  });

  describe('sha resolution', () => {
    const events = [
      push({ id: 'e1', at: 1, commits: ['c1', 'c2', 'c3'], before: 'b0' }),
    ];

    it.each<[string, string]>([
      ['a sha that no push recorded', sha('stranger')],
      ['a sha shorter than 7 characters', sha('c3').slice(0, 6)],
      ['a value that is not hex', 'not-a-sha'],
      ['a hex-looking value with a non-hex tail', `${sha('c3').slice(0, 7)}zz`],
    ])(
      'reports commit_not_in_history for %s used as head',
      (_name, headSha) => {
        expect(
          computeCommitRange({ baseSha: sha('b0'), headSha, events }),
        ).toEqual({ kind: 'unknown', reason: 'commit_not_in_history' });
      },
    );

    it('reports commit_not_in_history when the head prefix matches two commits', () => {
      const prefix = 'abcdef1';
      const first = `${prefix}${'0'.repeat(33)}`;
      const second = `${prefix}${'1'.repeat(33)}`;
      const ambiguous = push({ id: 'e1', at: 1, commits: ['c1'] });
      ambiguous.commits = [
        { ...commit('x', 0), sha: first },
        { ...commit('y', 1), sha: second },
      ];
      ambiguous.commitSha = second;

      expect(
        computeCommitRange({
          baseSha: sha('b0'),
          headSha: prefix,
          events: [ambiguous],
        }),
      ).toEqual({ kind: 'unknown', reason: 'commit_not_in_history' });
    });

    it('reports commit_not_in_history when the base prefix is ambiguous', () => {
      const prefix = 'abcdef1';
      const first = `${prefix}${'0'.repeat(33)}`;
      const second = `${prefix}${'1'.repeat(33)}`;
      const ambiguous = push({ id: 'e1', at: 1, commits: ['c1', 'c2'] });
      ambiguous.commits = [
        { ...commit('x', 0), sha: first },
        { ...commit('y', 1), sha: second },
        { ...commit('c2', 2) },
      ];
      ambiguous.commitSha = sha('c2');

      expect(
        computeCommitRange({
          baseSha: prefix,
          headSha: sha('c2'),
          events: [ambiguous],
        }),
      ).toEqual({ kind: 'unknown', reason: 'commit_not_in_history' });
    });

    it('reports commit_not_in_history when only the base is unknown', () => {
      expect(
        computeCommitRange({
          baseSha: sha('stranger'),
          headSha: sha('c3'),
          events,
        }),
      ).toEqual({ kind: 'unknown', reason: 'commit_not_in_history' });
    });

    it('resolves short and upper-case run shas to the full shas', () => {
      const result = computeCommitRange({
        baseSha: sha('b0').slice(0, 7).toUpperCase(),
        headSha: sha('c3').slice(0, 12),
        events,
      });

      expect(result).toMatchObject({
        kind: 'range',
        baseSha: sha('b0'),
        headSha: sha('c3'),
      });
      expect(shasOf(result)).toEqual(labelsToShas('c1', 'c2', 'c3'));
    });

    it('reports commit_not_in_history for the tip of a push that reported no commits', () => {
      const result = computeCommitRange({
        baseSha: sha('b0'),
        headSha: sha('lost'),
        events: [
          ...events,
          push({ id: 'e2', at: 2, commits: [], tip: 'lost', before: 'c3' }),
        ],
      });

      expect(result).toEqual({
        kind: 'unknown',
        reason: 'commit_not_in_history',
      });
    });
  });

  describe('connection', () => {
    it('reports no_repository_connected when the project has no connection', () => {
      expect(
        computeCommitRange({
          baseSha: sha('b'),
          headSha: sha('h'),
          events: null,
        }),
      ).toEqual({ kind: 'unknown', reason: 'no_repository_connected' });
    });

    it('reports commit_not_in_history when a connection has recorded no push yet', () => {
      expect(
        computeCommitRange({
          baseSha: sha('b'),
          headSha: sha('h'),
          events: [],
        }),
      ).toEqual({ kind: 'unknown', reason: 'commit_not_in_history' });
    });
  });

  describe('range', () => {
    it('returns the commits after the base inside the head own push', () => {
      const events = [
        push({ id: 'e1', at: 1, commits: ['a', 'b', 'c', 'd'], before: 'x' }),
      ];

      const result = computeCommitRange({
        baseSha: sha('b'),
        headSha: sha('d'),
        events,
      });

      expect(result).toEqual({
        kind: 'range',
        baseSha: sha('b'),
        headSha: sha('d'),
        commits: [
          { ...commit('c', 2), eventId: 'e1', branch: 'main' },
          { ...commit('d', 3), eventId: 'e1', branch: 'main' },
        ],
      });
    });

    it('stops at the previous tip when the base is the push beforeSha', () => {
      const events = [
        push({ id: 'e1', at: 1, commits: ['a1', 'a2'], before: 'a0' }),
        push({ id: 'e2', at: 2, commits: ['b1', 'b2'], before: 'a2' }),
      ];

      const result = computeCommitRange({
        baseSha: sha('a2'),
        headSha: sha('b2'),
        events,
      });

      expect(shasOf(result)).toEqual(labelsToShas('b1', 'b2'));
    });

    it('chains several pushes oldest first', () => {
      const events = [
        push({ id: 'e1', at: 1, commits: ['a'], before: 'a0' }),
        push({ id: 'e2', at: 2, commits: ['b1', 'b2'], before: 'a' }),
        push({ id: 'e3', at: 3, commits: ['c1', 'c2'], before: 'b2' }),
        push({ id: 'e4', at: 4, commits: ['d1'], before: 'c2' }),
      ];

      const result = computeCommitRange({
        baseSha: sha('a'),
        headSha: sha('d1'),
        events,
      });

      expect(shasOf(result)).toEqual(
        labelsToShas('b1', 'b2', 'c1', 'c2', 'd1'),
      );
      expect(
        result.kind === 'range' && result.commits.map((c) => c.eventId),
      ).toEqual(['e2', 'e2', 'e3', 'e3', 'e4']);
    });

    it('accepts a base that is only the beforeSha of the earliest recorded push', () => {
      const events = [
        push({ id: 'e1', at: 1, commits: ['a'], before: 'a0' }),
        push({ id: 'e2', at: 2, commits: ['b'], before: 'a' }),
      ];

      const result = computeCommitRange({
        baseSha: sha('a0'),
        headSha: sha('b'),
        events,
      });

      expect(shasOf(result)).toEqual(labelsToShas('a', 'b'));
    });

    it('includes only the commits up to the head when the head is in the middle of a push', () => {
      const events = [
        push({ id: 'e1', at: 1, commits: ['c1', 'c2', 'c3'], before: 'b' }),
      ];

      const result = computeCommitRange({
        baseSha: sha('b'),
        headSha: sha('c2'),
        events,
      });

      expect(shasOf(result)).toEqual(labelsToShas('c1', 'c2'));
    });

    it('orders the commits of a push by position, not by array order', () => {
      const event = push({
        id: 'e1',
        at: 1,
        commits: ['c1', 'c2', 'c3'],
        before: 'b',
      });
      event.commits = [...event.commits].reverse();

      const result = computeCommitRange({
        baseSha: sha('b'),
        headSha: sha('c3'),
        events: [event],
      });

      expect(shasOf(result)).toEqual(labelsToShas('c1', 'c2', 'c3'));
    });

    it('does not repeat a commit that two pushes in the chain both list', () => {
      const events = [
        push({ id: 'e1', at: 1, commits: ['a'], before: 'a0' }),
        push({ id: 'e2', at: 2, commits: ['c', 'd'], before: 'a' }),
        push({ id: 'e3', at: 3, commits: ['d', 'e'], before: 'd' }),
      ];

      const result = computeCommitRange({
        baseSha: sha('a'),
        headSha: sha('e'),
        events,
      });

      expect(shasOf(result)).toEqual(labelsToShas('c', 'd', 'e'));
    });

    it('ignores pull request events, even when they list the commits', () => {
      const chain = [
        push({ id: 'e1', at: 1, commits: ['a'], before: 'a0' }),
        push({ id: 'e2', at: 2, commits: ['b'], before: 'a' }),
      ];
      const pullRequest = push({
        id: 'pr1',
        at: 9,
        kind: 'PULL_REQUEST',
        branch: 'feature',
        commits: ['x', 'b'],
        before: 'a',
      });
      const input = { baseSha: sha('a'), headSha: sha('b') };

      expect(
        computeCommitRange({ ...input, events: [...chain, pullRequest] }),
      ).toEqual(computeCommitRange({ ...input, events: chain }));
      expect(
        computeCommitRange({
          baseSha: sha('a'),
          headSha: sha('x'),
          events: [...chain, pullRequest],
        }),
      ).toEqual({ kind: 'unknown', reason: 'commit_not_in_history' });
    });
  });

  describe('a commit recorded on a feature branch and on main', () => {
    const events = [
      push({ id: 'p0', at: 1, commits: ['a'], before: 'a0' }),
      push({
        id: 'feature',
        at: 2,
        branch: 'feature',
        commits: ['f1', 'f2'],
        before: null,
      }),
      push({ id: 'merge', at: 3, commits: ['f1', 'f2', 'm'], before: 'a' }),
      push({ id: 'p4', at: 4, commits: ['n1'], before: 'm' }),
      push({
        id: 'other',
        at: 5,
        branch: 'other',
        commits: ['x1'],
        before: null,
      }),
    ];

    it('follows the main chain and attributes every commit to main', () => {
      const result = computeCommitRange({
        baseSha: sha('a'),
        headSha: sha('n1'),
        events,
      });

      expect(shasOf(result)).toEqual(labelsToShas('f1', 'f2', 'm', 'n1'));
      expect(
        result.kind === 'range' && result.commits.map((c) => c.branch),
      ).toEqual(['main', 'main', 'main', 'main']);
    });

    it('does not mix branches when the head is a commit both pushes list', () => {
      const result = computeCommitRange({
        baseSha: sha('a'),
        headSha: sha('f2'),
        events,
      });

      expect(shasOf(result)).toEqual(labelsToShas('f1', 'f2'));
      expect(
        result.kind === 'range' && result.commits.map((c) => c.eventId),
      ).toEqual(['merge', 'merge']);
    });

    it('backtracks to the feature push when the newer push cannot reach the base', () => {
      const withFeatureBase = [
        push({ id: 'p0', at: 1, commits: ['a'], before: 'a0' }),
        push({
          id: 'f0',
          at: 2,
          branch: 'feature',
          commits: ['f0'],
          before: 'a',
        }),
        push({
          id: 'feature',
          at: 3,
          branch: 'feature',
          commits: ['f1', 'f2'],
          before: 'f0',
        }),
        push({ id: 'merge', at: 4, commits: ['f1', 'f2', 'm'], before: 'a' }),
      ];

      const result = computeCommitRange({
        baseSha: sha('f0'),
        headSha: sha('f2'),
        events: withFeatureBase,
      });

      expect(shasOf(result)).toEqual(labelsToShas('f1', 'f2'));
      expect(
        result.kind === 'range' && result.commits.map((c) => c.branch),
      ).toEqual(['feature', 'feature']);
    });

    it('prefers the most recently received push when two chains reach the base', () => {
      const both = [
        push({ id: 'p0', at: 1, commits: ['a'], before: 'a0' }),
        push({
          id: 'feature',
          at: 2,
          branch: 'feature',
          commits: ['f1', 'f2'],
          before: 'a',
        }),
        push({ id: 'merge', at: 3, commits: ['f1', 'f2', 'm'], before: 'a' }),
      ];
      const eventIds = (events: CommitRangeEvent[]) => {
        const result = computeCommitRange({
          baseSha: sha('a'),
          headSha: sha('f2'),
          events,
        });
        return result.kind === 'range' && result.commits.map((c) => c.eventId);
      };

      expect(eventIds(both)).toEqual(['merge', 'merge']);

      const reversedClock = both.map((event) =>
        event.id === 'feature'
          ? { ...event, receivedAt: new Date(Date.UTC(2026, 4, 1, 9)) }
          : event,
      );
      expect(eventIds(reversedClock)).toEqual(['feature', 'feature']);
    });

    it('gives the same result for every ordering of the events', () => {
      const expected = computeCommitRange({
        baseSha: sha('a'),
        headSha: sha('n1'),
        events,
      });

      expect(expected.kind).toBe('range');
      for (const ordering of permutations(events)) {
        expect(
          computeCommitRange({
            baseSha: sha('a'),
            headSha: sha('n1'),
            events: ordering,
          }),
        ).toEqual(expected);
      }
    });

    it('gives the same result for Date and ISO string receivedAt', () => {
      const asDates = events.map((event) => ({
        ...event,
        receivedAt: new Date(event.receivedAt),
      }));
      const mixed = events.map((event, index) =>
        index % 2 === 0
          ? { ...event, receivedAt: new Date(event.receivedAt) }
          : event,
      );
      const run = (list: CommitRangeEvent[]) =>
        computeCommitRange({
          baseSha: sha('a'),
          headSha: sha('n1'),
          events: list,
        });

      expect(run(asDates)).toEqual(run(events));
      expect(run(mixed)).toEqual(run(events));
    });
  });

  describe('history_gap', () => {
    const base = push({ id: 'e0', at: 1, commits: ['b'], before: 'b0' });

    it('reports it when a beforeSha has no recorded push', () => {
      const events = [
        base,
        push({ id: 'e2', at: 2, commits: ['c'], before: 'unrecorded' }),
      ];

      expect(
        computeCommitRange({ baseSha: sha('b'), headSha: sha('c'), events }),
      ).toEqual({ kind: 'unknown', reason: 'history_gap' });
    });

    it('reports it when the push created the ref', () => {
      const events = [
        base,
        push({ id: 'e2', at: 2, commits: ['c'], before: null }),
      ];

      expect(
        computeCommitRange({ baseSha: sha('b'), headSha: sha('c'), events }),
      ).toEqual({ kind: 'unknown', reason: 'history_gap' });
    });

    it('reports it when a push in the chain was truncated', () => {
      const events = [
        base,
        push({
          id: 'e2',
          at: 2,
          commits: ['c1'],
          before: 'b0x',
          truncated: true,
        }),
        push({ id: 'e3', at: 3, commits: ['c2'], before: 'c1' }),
      ];

      expect(
        computeCommitRange({ baseSha: sha('b'), headSha: sha('c2'), events }),
      ).toEqual({ kind: 'unknown', reason: 'history_gap' });
    });

    it('reports it when the truncated push starts exactly at the base, because its oldest commits are missing', () => {
      const events = [
        base,
        push({ id: 'e2', at: 2, commits: ['c'], before: 'b', truncated: true }),
      ];

      expect(
        computeCommitRange({ baseSha: sha('b'), headSha: sha('c'), events }),
      ).toEqual({ kind: 'unknown', reason: 'history_gap' });
    });

    it('reports it when a push in the chain reported no commits', () => {
      const events = [
        base,
        push({ id: 'e2', at: 2, commits: [], tip: 'y', before: 'b' }),
        push({ id: 'e3', at: 3, commits: ['c'], before: 'y' }),
      ];

      expect(
        computeCommitRange({ baseSha: sha('b'), headSha: sha('c'), events }),
      ).toEqual({ kind: 'unknown', reason: 'history_gap' });
    });

    it('still returns a range when the base is inside a truncated push', () => {
      const events = [
        push({
          id: 'e1',
          at: 1,
          commits: ['b', 'c'],
          before: 'b0x',
          truncated: true,
        }),
      ];

      const result = computeCommitRange({
        baseSha: sha('b'),
        headSha: sha('c'),
        events,
      });

      expect(shasOf(result)).toEqual(labelsToShas('c'));
    });

    it('terminates when beforeSha links form a cycle', () => {
      const events = [
        push({ id: 'other', at: 1, commits: ['z'], before: null }),
        push({ id: 'a', at: 2, commits: ['a1'], before: 'b1' }),
        push({ id: 'b', at: 3, commits: ['b1'], before: 'a1' }),
      ];

      expect(
        computeCommitRange({ baseSha: sha('z'), headSha: sha('a1'), events }),
      ).toEqual({ kind: 'unknown', reason: 'history_gap' });
    });
  });

  describe('history_rewritten', () => {
    it('reports it when the chain would cross a forced push', () => {
      const events = [
        push({ id: 'e1', at: 1, commits: ['b'], before: 'b0' }),
        push({ id: 'e2', at: 2, commits: ['c'], before: 'old', forced: true }),
      ];

      expect(
        computeCommitRange({ baseSha: sha('b'), headSha: sha('c'), events }),
      ).toEqual({ kind: 'unknown', reason: 'history_rewritten' });
    });

    it('still returns a range when the base is inside the forced push', () => {
      const events = [
        push({
          id: 'e1',
          at: 1,
          commits: ['b', 'c'],
          before: 'old',
          forced: true,
        }),
      ];

      const result = computeCommitRange({
        baseSha: sha('b'),
        headSha: sha('c'),
        events,
      });

      expect(shasOf(result)).toEqual(labelsToShas('c'));
    });

    it('still returns a range when the forced push started at the base', () => {
      const events = [
        push({ id: 'e1', at: 1, commits: ['b'], before: 'b0' }),
        push({ id: 'e2', at: 2, commits: ['c'], before: 'b', forced: true }),
      ];

      const result = computeCommitRange({
        baseSha: sha('b'),
        headSha: sha('c'),
        events,
      });

      expect(shasOf(result)).toEqual(labelsToShas('c'));
    });
  });

  describe('different_branch', () => {
    it('reports it when base and head were only recorded on disjoint branches', () => {
      const events = [
        push({ id: 'e1', at: 1, commits: ['m1'], before: null }),
        push({
          id: 'e2',
          at: 2,
          branch: 'develop',
          commits: ['d1'],
          before: null,
        }),
      ];

      expect(
        computeCommitRange({ baseSha: sha('m1'), headSha: sha('d1'), events }),
      ).toEqual({ kind: 'unknown', reason: 'different_branch' });
    });

    it('returns a range when the base was also recorded on the head branch', () => {
      const events = [
        push({ id: 'e1', at: 1, commits: ['b'], before: 'b0' }),
        push({
          id: 'e2',
          at: 2,
          branch: 'develop',
          commits: ['b', 'c'],
          before: null,
        }),
      ];

      const result = computeCommitRange({
        baseSha: sha('b'),
        headSha: sha('c'),
        events,
      });

      expect(shasOf(result)).toEqual(labelsToShas('c'));
    });
  });

  describe('out_of_order', () => {
    it('reports it when the base is a descendant of the head', () => {
      const events = [
        push({ id: 'e1', at: 1, commits: ['a'], before: null }),
        push({ id: 'e2', at: 2, commits: ['b'], before: 'a' }),
      ];

      expect(
        computeCommitRange({ baseSha: sha('b'), headSha: sha('a'), events }),
      ).toEqual({ kind: 'unknown', reason: 'out_of_order' });
    });
  });

  describe('range_too_large', () => {
    const events = [
      push({ id: 'e1', at: 1, commits: ['b'], before: 'b0' }),
      push({ id: 'e2', at: 2, commits: ['c1', 'c2', 'c3', 'c4'], before: 'b' }),
    ];
    const input = { baseSha: sha('b'), headSha: sha('c4'), events };

    it('accepts a range of exactly maxCommits commits', () => {
      const result = computeCommitRange({ ...input, maxCommits: 4 });

      expect(shasOf(result)).toEqual(labelsToShas('c1', 'c2', 'c3', 'c4'));
    });

    it('rejects a range one commit over maxCommits', () => {
      expect(computeCommitRange({ ...input, maxCommits: 3 })).toEqual({
        kind: 'unknown',
        reason: 'range_too_large',
      });
    });

    it('applies the same limit when the base is inside the head push', () => {
      const single = [
        push({
          id: 'e1',
          at: 1,
          commits: ['b', 'c1', 'c2', 'c3'],
          before: 'x',
        }),
      ];
      const sameInput = {
        baseSha: sha('b'),
        headSha: sha('c3'),
        events: single,
      };

      expect(
        shasOf(computeCommitRange({ ...sameInput, maxCommits: 3 })),
      ).toEqual(labelsToShas('c1', 'c2', 'c3'));
      expect(computeCommitRange({ ...sameInput, maxCommits: 2 })).toEqual({
        kind: 'unknown',
        reason: 'range_too_large',
      });
    });

    it.each([0, -3, Number.NaN])(
      'falls back to the default limit when maxCommits is %s',
      (maxCommits) => {
        const result = computeCommitRange({ ...input, maxCommits });

        expect(result.kind).toBe('range');
      },
    );

    it('uses DEFAULT_MAX_RANGE_COMMITS when maxCommits is omitted', () => {
      const labels = (count: number) =>
        Array.from({ length: count }, (_, index) => `c${index}`);
      const chainOf = (count: number) => [
        push({ id: 'e1', at: 1, commits: ['b'], before: 'b0' }),
        push({ id: 'e2', at: 2, commits: labels(count), before: 'b' }),
      ];
      const run = (count: number) =>
        computeCommitRange({
          baseSha: sha('b'),
          headSha: sha(`c${count - 1}`),
          events: chainOf(count),
        });

      expect(run(DEFAULT_MAX_RANGE_COMMITS).kind).toBe('range');
      expect(run(DEFAULT_MAX_RANGE_COMMITS + 1)).toEqual({
        kind: 'unknown',
        reason: 'range_too_large',
      });
    });
  });

  describe('reason priority', () => {
    it('reports out_of_order before any walk failure', () => {
      const events = [
        push({ id: 'e1', at: 1, commits: ['h'], before: 'old', forced: true }),
        push({ id: 'e2', at: 2, commits: ['b'], before: 'h' }),
      ];

      expect(
        computeCommitRange({ baseSha: sha('b'), headSha: sha('h'), events }),
      ).toEqual({ kind: 'unknown', reason: 'out_of_order' });
    });

    it('reports range_too_large before history_rewritten', () => {
      const events = [
        push({ id: 'e0', at: 1, commits: ['b'], before: 'b0' }),
        push({
          id: 'big',
          at: 2,
          commits: ['h1', 'h2', 'h3', 'h'],
          before: 'b',
        }),
        push({
          id: 'forced',
          at: 3,
          commits: ['h'],
          before: 'old',
          forced: true,
        }),
      ];
      const input = { baseSha: sha('b'), headSha: sha('h'), events };

      expect(computeCommitRange({ ...input, maxCommits: 3 })).toEqual({
        kind: 'unknown',
        reason: 'range_too_large',
      });
      expect(
        computeCommitRange({
          ...input,
          events: events.slice(0, 1).concat(events.slice(2)),
        }),
      ).toEqual({
        kind: 'unknown',
        reason: 'history_rewritten',
      });
    });

    it('reports history_rewritten before different_branch', () => {
      const events = [
        push({
          id: 'e1',
          at: 1,
          branch: 'develop',
          commits: ['b'],
          before: null,
        }),
        push({ id: 'e2', at: 2, commits: ['h'], before: 'old', forced: true }),
      ];

      expect(
        computeCommitRange({ baseSha: sha('b'), headSha: sha('h'), events }),
      ).toEqual({ kind: 'unknown', reason: 'history_rewritten' });
    });

    it('reports commit_not_in_history for an unknown base even when the head chain is intact', () => {
      const events = [push({ id: 'e1', at: 1, commits: ['h'], before: null })];

      expect(
        computeCommitRange({
          baseSha: sha('stranger'),
          headSha: sha('h'),
          events,
        }),
      ).toEqual({ kind: 'unknown', reason: 'commit_not_in_history' });
    });
  });

  describe('robustness', () => {
    it('stays fast when every commit was pushed twice and the base is unreachable', () => {
      // Each commit is listed by a main push and by a feature push, so the naive
      // backtracking search would explore 2^40 paths before giving up.
      const pairs = 40;
      const events: CommitRangeEvent[] = [
        push({
          id: 'other',
          at: 0,
          branch: 'other',
          commits: ['x'],
          before: null,
        }),
      ];
      for (let index = 1; index <= pairs; index += 1) {
        const before = index === 1 ? null : `m${index - 1}`;
        events.push(
          push({
            id: `main-${index}`,
            at: index,
            commits: [`m${index}`],
            before,
          }),
          push({
            id: `feature-${index}`,
            at: index,
            branch: 'feature',
            commits: [`m${index}`],
            before,
          }),
        );
      }

      expect(
        computeCommitRange({
          baseSha: sha('x'),
          headSha: sha(`m${pairs}`),
          events,
        }),
      ).toEqual({ kind: 'unknown', reason: 'different_branch' });
    });

    it('does not mutate its input', () => {
      const merge = push({
        id: 'merge',
        at: 3,
        commits: ['f1', 'f2', 'm'],
        before: 'a',
      });
      merge.commits = [...merge.commits].reverse();
      const events = deepFreeze([
        push({ id: 'p0', at: 1, commits: ['a'], before: 'a0' }),
        push({
          id: 'feature',
          at: 2,
          branch: 'feature',
          commits: ['f1', 'f2'],
          before: null,
        }),
        merge,
      ]);
      const snapshot = JSON.stringify(events);

      const result = computeCommitRange({
        baseSha: sha('a'),
        headSha: sha('m'),
        events,
      });

      expect(result.kind).toBe('range');
      expect(JSON.stringify(events)).toBe(snapshot);
    });
  });
});
