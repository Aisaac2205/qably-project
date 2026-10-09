/**
 * Candidate commit range between two runs, rebuilt from recorded push events.
 *
 * The result lists the commits that were pushed between a baseline run and a
 * later run. They are candidates, never a verdict: nothing here says which
 * commit changed a result. When the recorded history cannot prove a chain from
 * the baseline to the later run, the function answers `unknown` with a reason
 * instead of guessing.
 *
 * Pure: no I/O, no clock, no framework types, and the input is never mutated.
 * The result does not depend on the order of `events`.
 */

export const DEFAULT_MAX_RANGE_COMMITS = 100;

const MIN_SHA_PREFIX_LENGTH = 7;
const HEX = /^[0-9a-f]+$/;

export type CommitRangeUnknownReason =
  | 'no_commit_reported'
  | 'no_repository_connected'
  | 'commit_not_in_history'
  | 'different_branch'
  | 'history_gap'
  | 'history_rewritten'
  | 'out_of_order'
  | 'range_too_large';

export interface CommitRangeCommit {
  /** Lowercase 40-hex commit sha. */
  sha: string;
  /** 0-based, oldest first, in the order the provider delivered. */
  position: number;
  message: string;
  author: string;
  committedAt: Date | string | null;
  url: string | null;
}

export interface CommitRangeEvent {
  id: string;
  kind: 'PUSH' | 'PULL_REQUEST';
  branch: string;
  /** Tip after the push. */
  commitSha: string;
  /** Tip before the push; null for a new ref or when unknown. */
  beforeSha: string | null;
  forced: boolean;
  /** `commits` omits some commits of the push (the oldest ones). */
  commitsTruncated: boolean;
  receivedAt: Date | string;
  commits: readonly CommitRangeCommit[];
}

/** A candidate commit together with the push it was read from. */
export interface CommitRangeEntry extends CommitRangeCommit {
  eventId: string;
  branch: string;
}

export type CommitRangeResult =
  | { kind: 'same_commit'; sha: string }
  | {
      kind: 'range';
      baseSha: string;
      headSha: string;
      /** Oldest first; the base is excluded and the head is included. */
      commits: CommitRangeEntry[];
    }
  | { kind: 'unknown'; reason: CommitRangeUnknownReason };

export interface ComputeCommitRangeInput {
  /** `Run.commitSha` of the baseline run, as the run reported it. */
  baseSha: string | null | undefined;
  /** `Run.commitSha` of the later run, as the run reported it. */
  headSha: string | null | undefined;
  /** Recorded SCM events, or null when the project has no repository connection. */
  events: readonly CommitRangeEvent[] | null;
  /** Largest range to return; non-positive values fall back to the default. */
  maxCommits?: number;
}

interface PreparedEvent {
  id: string;
  branch: string;
  commitSha: string;
  beforeSha: string | null;
  forced: boolean;
  commitsTruncated: boolean;
  receivedAtMs: number;
  /** Ordered by `position`, oldest first. */
  commits: readonly CommitRangeCommit[];
}

type EventsByCommitSha = ReadonlyMap<string, readonly PreparedEvent[]>;

interface WalkOutcome {
  /** Oldest first, base excluded, head included; null when no chain was proven. */
  commits: CommitRangeEntry[] | null;
  /** Some path was abandoned because it passed the commit limit. */
  hitLimit: boolean;
  /** Some path was abandoned because it would cross a forced push. */
  crossedForcedPush: boolean;
}

const unknown = (reason: CommitRangeUnknownReason): CommitRangeResult => ({
  kind: 'unknown',
  reason,
});

export function computeCommitRange(
  input: ComputeCommitRangeInput,
): CommitRangeResult {
  const baseRunSha = normalizeRunSha(input.baseSha);
  const headRunSha = normalizeRunSha(input.headSha);
  if (baseRunSha === null || headRunSha === null) {
    return unknown('no_commit_reported');
  }

  if (isSameCommit(baseRunSha, headRunSha)) {
    return {
      kind: 'same_commit',
      sha: baseRunSha.length >= headRunSha.length ? baseRunSha : headRunSha,
    };
  }

  if (input.events === null) return unknown('no_repository_connected');

  const events = prepareEvents(input.events);
  const knownShas = collectKnownShas(events);
  const headSha = resolveSha(knownShas, headRunSha);
  if (headSha === null) return unknown('commit_not_in_history');
  const baseSha = resolveSha(knownShas, baseRunSha);

  const maxCommits =
    input.maxCommits !== undefined && input.maxCommits > 0
      ? input.maxCommits
      : DEFAULT_MAX_RANGE_COMMITS;
  const eventsByCommitSha = indexEventsByCommitSha(events);

  const walk = walkBack(eventsByCommitSha, headSha, baseSha, maxCommits);
  if (walk.commits !== null && baseSha !== null) {
    return { kind: 'range', baseSha, headSha, commits: walk.commits };
  }

  return unknown(
    explainFailure(walk, { events, eventsByCommitSha, baseSha, headSha }),
  );
}

/**
 * Picks the reason when no chain was proven, by priority: out_of_order,
 * range_too_large, history_rewritten, commit_not_in_history (base unknown),
 * different_branch, history_gap.
 */
function explainFailure(
  walk: WalkOutcome,
  context: {
    events: readonly PreparedEvent[];
    eventsByCommitSha: EventsByCommitSha;
    baseSha: string | null;
    headSha: string;
  },
): CommitRangeUnknownReason {
  const { events, eventsByCommitSha, baseSha, headSha } = context;
  if (
    baseSha !== null &&
    walkBack(eventsByCommitSha, baseSha, headSha, Number.POSITIVE_INFINITY)
      .commits !== null
  ) {
    return 'out_of_order';
  }
  if (walk.hitLimit) return 'range_too_large';
  if (walk.crossedForcedPush) return 'history_rewritten';
  if (baseSha === null) return 'commit_not_in_history';
  const baseBranches = branchesInvolving(events, baseSha);
  const headBranches = branchesInvolving(events, headSha);
  return areDisjoint(baseBranches, headBranches)
    ? 'different_branch'
    : 'history_gap';
}

/**
 * Walks from `startSha` toward older pushes until `targetSha` is reached.
 *
 * Inside a push the walk collects every commit from the cursor down to the
 * oldest listed one. If the target is not among them, it follows the push's
 * `beforeSha` to the pushes that list that commit. A sha can be listed by
 * several pushes (a feature branch and the later merge to main), so every
 * candidate push is tried, newest first, and the first complete chain wins.
 */
function walkBack(
  eventsByCommitSha: EventsByCommitSha,
  startSha: string,
  targetSha: string | null,
  limit: number,
): WalkOutcome {
  const collected: CommitRangeEntry[] = [];
  const collectedShas = new Set<string>();
  const eventsOnPath = new Set<string>();
  // Collected count at the moment a (push, cursor) state last failed. A state
  // that failed with that many commits already collected fails again with more.
  const failedAtCount = new Map<string, number>();
  let hitLimit = false;
  let crossedForcedPush = false;

  const followEvent = (event: PreparedEvent, cursor: string): boolean => {
    const cursorIndex = event.commits.findIndex(
      (candidate) => candidate.sha === cursor,
    );
    for (let index = cursorIndex; index >= 0; index -= 1) {
      const candidate = event.commits[index];
      if (candidate.sha === targetSha) return true;
      if (collectedShas.has(candidate.sha)) continue;
      collected.push({ ...candidate, eventId: event.id, branch: event.branch });
      collectedShas.add(candidate.sha);
      if (collected.length > limit) {
        hitLimit = true;
        return false;
      }
    }

    // A truncated push dropped its oldest commits, so its listed commits are
    // complete only above the oldest one it kept: reaching the base through
    // the push's own beforeSha would hide the dropped ones.
    if (
      !event.commitsTruncated &&
      event.beforeSha !== null &&
      event.beforeSha === targetSha
    ) {
      return true;
    }
    if (event.commitsTruncated) return false;
    if (event.forced) {
      crossedForcedPush = true;
      return false;
    }
    if (event.beforeSha === null) return false;
    return explore(event.beforeSha);
  };

  const explore = (cursor: string): boolean => {
    for (const event of eventsByCommitSha.get(cursor) ?? []) {
      if (eventsOnPath.has(event.id)) continue;
      const stateKey = `${event.id}\u0000${cursor}`;
      const countOnEntry = collected.length;
      const failedBefore = failedAtCount.get(stateKey);
      if (failedBefore !== undefined && failedBefore <= countOnEntry) continue;

      eventsOnPath.add(event.id);
      if (followEvent(event, cursor)) return true;
      eventsOnPath.delete(event.id);

      while (collected.length > countOnEntry) {
        const removed = collected.pop();
        if (removed) collectedShas.delete(removed.sha);
      }
      failedAtCount.set(stateKey, countOnEntry);
    }
    return false;
  };

  const reached = explore(startSha);
  return {
    commits: reached ? collected.slice().reverse() : null,
    hitLimit,
    crossedForcedPush,
  };
}

function normalizeRunSha(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized === '' ? null : normalized;
}

function isShaPrefix(prefix: string, full: string): boolean {
  return (
    prefix.length >= MIN_SHA_PREFIX_LENGTH &&
    HEX.test(prefix) &&
    full.startsWith(prefix)
  );
}

function isSameCommit(a: string, b: string): boolean {
  return a === b || isShaPrefix(a, b) || isShaPrefix(b, a);
}

/**
 * Resolves a run sha to a full sha known from the pushes. Null when no known
 * sha matches or when a short sha matches more than one.
 */
function resolveSha(
  knownShas: ReadonlySet<string>,
  runSha: string,
): string | null {
  if (knownShas.has(runSha)) return runSha;
  if (runSha.length < MIN_SHA_PREFIX_LENGTH || !HEX.test(runSha)) return null;
  let match: string | null = null;
  for (const known of knownShas) {
    if (!known.startsWith(runSha)) continue;
    if (match !== null) return null;
    match = known;
  }
  return match;
}

/** Pushes that can contribute: PUSH events that listed at least one commit. */
function prepareEvents(events: readonly CommitRangeEvent[]): PreparedEvent[] {
  return events
    .filter((event) => event.kind === 'PUSH' && event.commits.length > 0)
    .map((event) => ({
      id: event.id,
      branch: event.branch,
      commitSha: event.commitSha,
      beforeSha: event.beforeSha,
      forced: event.forced,
      commitsTruncated: event.commitsTruncated,
      receivedAtMs: toEpochMs(event.receivedAt),
      commits: [...event.commits].sort((a, b) => a.position - b.position),
    }))
    .sort(newestFirst);
}

function toEpochMs(value: Date | string): number {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

function newestFirst(a: PreparedEvent, b: PreparedEvent): number {
  if (a.receivedAtMs !== b.receivedAtMs) {
    return a.receivedAtMs > b.receivedAtMs ? -1 : 1;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** Every sha a push mentions: its commits, its tip and the tip before it. */
function collectKnownShas(events: readonly PreparedEvent[]): Set<string> {
  const known = new Set<string>();
  for (const event of events) {
    for (const candidate of event.commits) known.add(candidate.sha);
    known.add(event.commitSha);
    if (event.beforeSha !== null) known.add(event.beforeSha);
  }
  return known;
}

function indexEventsByCommitSha(
  events: readonly PreparedEvent[],
): EventsByCommitSha {
  const index = new Map<string, PreparedEvent[]>();
  for (const event of events) {
    for (const candidate of event.commits) {
      const listed = index.get(candidate.sha);
      if (listed === undefined) {
        index.set(candidate.sha, [event]);
      } else if (listed[listed.length - 1] !== event) {
        listed.push(event);
      }
    }
  }
  return index;
}

function branchesInvolving(
  events: readonly PreparedEvent[],
  sha: string,
): Set<string> {
  const branches = new Set<string>();
  for (const event of events) {
    const involved =
      event.commitSha === sha ||
      event.beforeSha === sha ||
      event.commits.some((candidate) => candidate.sha === sha);
    if (involved) branches.add(event.branch);
  }
  return branches;
}

function areDisjoint(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const value of a) {
    if (b.has(value)) return false;
  }
  return true;
}
