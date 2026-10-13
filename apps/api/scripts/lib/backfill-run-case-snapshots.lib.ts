import type { RunCaseCatalogSnapshot } from '../../src/modules/runs/lib/catalog-snapshot';

export const DEFAULT_BATCH_SIZE = 500;

/** A run case that holds no snapshot, with the instant its run started. */
export interface UnsnapshottedRunCase {
  id: string;
  testCaseId: string | null;
  runStartedAt: Date;
}

/** The columns of a catalog version a backfilled snapshot is built from. */
export interface PublishedCaseVersion {
  id: string;
  testCaseId: string;
  version: number;
  title: string;
  steps: string[];
  expectedResult: string;
  publishedAt: Date;
}

/** Run cases of one test case that are all filled from the same version. */
export interface SnapshotFillGroup {
  testCaseId: string;
  testCaseVersionId: string;
  snapshot: RunCaseCatalogSnapshot;
  runCaseIds: string[];
}

export interface SnapshotBackfillPort {
  /** Run cases that already hold a snapshot, of any origin or shape. */
  countSnapshotted(): Promise<number>;
  /** Run cases with no snapshot in `id` order after the cursor. */
  readUnsnapshotted(
    afterId: string | undefined,
    take: number,
  ): Promise<UnsnapshottedRunCase[]>;
  /** Versions of the given cases published at or before `publishedUpTo`. */
  readPublishedVersions(
    testCaseIds: readonly string[],
    publishedUpTo: Date,
  ): Promise<PublishedCaseVersion[]>;
  /**
   * Writes every group in one transaction, only to rows that still have no
   * snapshot and still point at the group's test case. Returns the number of
   * rows written.
   */
  applyFills(groups: readonly SnapshotFillGroup[]): Promise<number>;
}

export interface SnapshotBackfillSummary {
  apply: boolean;
  /** Rows that held a snapshot before the pass; never read, never written. */
  alreadySnapshotted: number;
  /** Rows with no snapshot that the pass read. */
  scanned: number;
  /** Rows a version was in force for: filled by apply, would-fill in a dry run. */
  eligible: number;
  filled: number;
  /** Eligible rows that changed between the read and the write. */
  changedSinceRead: number;
  noVersionInForce: number;
  noLinkedCase: number;
}

export interface BatchProgress {
  batch: number;
  read: number;
  eligible: number;
  filled: number;
  scanned: number;
}

export interface SnapshotBackfillOptions {
  /** There is no default: only an explicit `true` writes. */
  apply: boolean;
  batchSize?: number;
  onBatch?: (progress: BatchProgress) => void;
}

/**
 * The version in force when a run started: the latest one published at or
 * before that instant. Content edited in place after a publish belongs to no
 * version, so this is the last published content, never the exact content.
 */
export function selectVersionInForce(
  versions: readonly PublishedCaseVersion[],
  startedAt: Date,
): PublishedCaseVersion | undefined {
  let inForce: PublishedCaseVersion | undefined;

  for (const candidate of versions) {
    if (candidate.publishedAt.getTime() > startedAt.getTime()) continue;

    if (inForce === undefined || isLater(candidate, inForce)) {
      inForce = candidate;
    }
  }

  return inForce;
}

function isLater(
  candidate: PublishedCaseVersion,
  current: PublishedCaseVersion,
): boolean {
  const byTime =
    candidate.publishedAt.getTime() - current.publishedAt.getTime();

  return byTime === 0 ? candidate.version > current.version : byTime > 0;
}

export function buildBackfillSnapshot(
  version: PublishedCaseVersion,
): RunCaseCatalogSnapshot {
  return {
    name: version.title,
    steps: [...version.steps],
    expectedResult: version.expectedResult,
    version: version.version,
    origin: 'backfill',
  };
}

function versionsByCase(
  versions: readonly PublishedCaseVersion[],
): Map<string, PublishedCaseVersion[]> {
  const byCase = new Map<string, PublishedCaseVersion[]>();

  for (const version of versions) {
    const forCase = byCase.get(version.testCaseId) ?? [];
    forCase.push(version);
    byCase.set(version.testCaseId, forCase);
  }

  return byCase;
}

interface BatchPlan {
  fills: SnapshotFillGroup[];
  eligible: number;
  noVersionInForce: number;
  noLinkedCase: number;
}

async function planBatch(
  port: SnapshotBackfillPort,
  batch: readonly UnsnapshottedRunCase[],
): Promise<BatchPlan> {
  const linked = batch.filter(
    (row): row is UnsnapshottedRunCase & { testCaseId: string } =>
      row.testCaseId !== null,
  );
  const plan: BatchPlan = {
    fills: [],
    eligible: 0,
    noVersionInForce: 0,
    noLinkedCase: batch.length - linked.length,
  };

  if (linked.length === 0) return plan;

  const latestStart = new Date(
    Math.max(...linked.map((row) => row.runStartedAt.getTime())),
  );
  const published = versionsByCase(
    await port.readPublishedVersions(
      [...new Set(linked.map((row) => row.testCaseId))],
      latestStart,
    ),
  );
  const groups = new Map<string, SnapshotFillGroup>();

  for (const row of linked) {
    const inForce = selectVersionInForce(
      published.get(row.testCaseId) ?? [],
      row.runStartedAt,
    );

    if (inForce === undefined) {
      plan.noVersionInForce += 1;
      continue;
    }

    plan.eligible += 1;

    const group = groups.get(inForce.id) ?? {
      testCaseId: row.testCaseId,
      testCaseVersionId: inForce.id,
      snapshot: buildBackfillSnapshot(inForce),
      runCaseIds: [],
    };
    group.runCaseIds.push(row.id);
    groups.set(inForce.id, group);
  }

  plan.fills = [...groups.values()];

  return plan;
}

export async function backfillRunCaseSnapshots(
  port: SnapshotBackfillPort,
  options: SnapshotBackfillOptions,
): Promise<SnapshotBackfillSummary> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const summary: SnapshotBackfillSummary = {
    apply: options.apply,
    alreadySnapshotted: await port.countSnapshotted(),
    scanned: 0,
    eligible: 0,
    filled: 0,
    changedSinceRead: 0,
    noVersionInForce: 0,
    noLinkedCase: 0,
  };

  let batchNumber = 0;
  let batch = await port.readUnsnapshotted(undefined, batchSize);

  while (batch.length > 0) {
    batchNumber += 1;
    const plan = await planBatch(port, batch);
    const written =
      options.apply && plan.fills.length > 0
        ? await port.applyFills(plan.fills)
        : 0;

    summary.scanned += batch.length;
    summary.eligible += plan.eligible;
    summary.filled += written;
    summary.noVersionInForce += plan.noVersionInForce;
    summary.noLinkedCase += plan.noLinkedCase;
    if (options.apply) summary.changedSinceRead += plan.eligible - written;

    options.onBatch?.({
      batch: batchNumber,
      read: batch.length,
      eligible: plan.eligible,
      filled: written,
      scanned: summary.scanned,
    });

    batch = await port.readUnsnapshotted(batch[batch.length - 1].id, batchSize);
  }

  return summary;
}
