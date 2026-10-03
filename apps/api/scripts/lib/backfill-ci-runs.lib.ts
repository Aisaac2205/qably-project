import type { RunSource } from '../../generated/prisma/client';

export const DEFAULT_BATCH_SIZE = 500;

const GITHUB_RUN_ID_PREFIX = /^gha-(\d+)-/;
const COMMIT_FIELDS = ['commitSha', 'commitMessage', 'commitAuthor'] as const;

export type CommitFields = Partial<
  Record<(typeof COMMIT_FIELDS)[number], string>
>;

export interface BackfillRunRow {
  id: string;
  projectId: string;
  organizationId: string;
  source: RunSource;
  externalId: string | null;
  startedAt: Date;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
}

export interface CiRunKey {
  projectId: string;
  source: RunSource;
  externalId: string;
}

export interface ExistingCiRun {
  id: string;
  startedAt: Date;
  lastReportedAt: Date;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
}

export interface CiRunPatch extends CommitFields {
  startedAt?: Date;
  lastReportedAt?: Date;
}

export interface NewCiRun extends CiRunKey, CommitFields {
  organizationId: string;
  startedAt: Date;
  lastReportedAt: Date;
}

export interface BackfillPort {
  readUnlinkedRuns(
    afterId: string | undefined,
    take: number,
  ): Promise<BackfillRunRow[]>;
  findCiRun(key: CiRunKey): Promise<ExistingCiRun | null>;
  createCiRun(input: NewCiRun): Promise<string>;
  updateCiRun(id: string, patch: CiRunPatch): Promise<void>;
  linkRuns(ciRunId: string, runIds: readonly string[]): Promise<number>;
}

export interface BackfillSummary {
  scanned: number;
  unattributable: number;
  ciRunsCreated: number;
  ciRunsUpdated: number;
  runsLinked: number;
}

interface RunGroup {
  key: CiRunKey;
  organizationId: string;
  rows: BackfillRunRow[];
}

export function parseCiRunExternalId(
  externalId: string | null,
): string | undefined {
  if (externalId === null) return undefined;
  return GITHUB_RUN_ID_PREFIX.exec(externalId)?.[1];
}

function groupRuns(batch: readonly BackfillRunRow[]) {
  const groups = new Map<string, RunGroup>();
  let unattributable = 0;

  for (const row of batch) {
    const externalId = parseCiRunExternalId(row.externalId);
    if (externalId === undefined) {
      unattributable += 1;
      continue;
    }

    const key = { projectId: row.projectId, source: row.source, externalId };
    const mapKey = JSON.stringify([key.projectId, key.source, key.externalId]);
    const group = groups.get(mapKey) ?? {
      key,
      organizationId: row.organizationId,
      rows: [],
    };
    group.rows.push(row);
    groups.set(mapKey, group);
  }

  return { groups: [...groups.values()], unattributable };
}

function commitFieldsOf(rows: readonly BackfillRunRow[]): CommitFields {
  const commit: CommitFields = {};
  for (const field of COMMIT_FIELDS) {
    const value = rows
      .map((row) => row[field])
      .find((candidate): candidate is string => candidate !== null);
    if (value !== undefined) commit[field] = value;
  }
  return commit;
}

function patchFor(
  existing: ExistingCiRun,
  startedAt: Date,
  lastReportedAt: Date,
  commit: CommitFields,
): CiRunPatch | undefined {
  const patch: CiRunPatch = {};
  if (startedAt < existing.startedAt) patch.startedAt = startedAt;
  if (lastReportedAt > existing.lastReportedAt) {
    patch.lastReportedAt = lastReportedAt;
  }
  for (const field of COMMIT_FIELDS) {
    const value = commit[field];
    if (existing[field] === null && value !== undefined) patch[field] = value;
  }
  return Object.keys(patch).length === 0 ? undefined : patch;
}

async function applyGroup(
  port: BackfillPort,
  group: RunGroup,
  summary: BackfillSummary,
): Promise<void> {
  const times = group.rows.map((row) => row.startedAt.getTime());
  const startedAt = new Date(Math.min(...times));
  const lastReportedAt = new Date(Math.max(...times));
  const commit = commitFieldsOf(group.rows);
  const existing = await port.findCiRun(group.key);

  let ciRunId: string;
  if (existing === null) {
    ciRunId = await port.createCiRun({
      ...group.key,
      organizationId: group.organizationId,
      startedAt,
      lastReportedAt,
      ...commit,
    });
    summary.ciRunsCreated += 1;
  } else {
    ciRunId = existing.id;
    const patch = patchFor(existing, startedAt, lastReportedAt, commit);
    if (patch !== undefined) {
      await port.updateCiRun(existing.id, patch);
      summary.ciRunsUpdated += 1;
    }
  }
  summary.runsLinked += await port.linkRuns(
    ciRunId,
    group.rows.map((row) => row.id),
  );
}

export async function backfillCiRuns(
  port: BackfillPort,
  options: { batchSize?: number } = {},
): Promise<BackfillSummary> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const summary: BackfillSummary = {
    scanned: 0,
    unattributable: 0,
    ciRunsCreated: 0,
    ciRunsUpdated: 0,
    runsLinked: 0,
  };

  let batch = await port.readUnlinkedRuns(undefined, batchSize);
  while (batch.length > 0) {
    const { groups, unattributable } = groupRuns(batch);
    summary.scanned += batch.length;
    summary.unattributable += unattributable;

    for (const group of groups) {
      await applyGroup(port, group, summary);
    }

    batch = await port.readUnlinkedRuns(batch[batch.length - 1].id, batchSize);
  }

  return summary;
}
