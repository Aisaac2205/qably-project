import type { RunSource } from '../../generated/prisma/client';
import { isUniqueViolation } from '../../src/prisma/is-unique-violation';

export const DEFAULT_BATCH_SIZE = 500;
export const MAX_MERGE_ATTEMPTS = 5;

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
  updateCiRunIfUnchanged(
    expected: ExistingCiRun,
    patch: CiRunPatch,
  ): Promise<boolean>;
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

async function createUnlessTaken(
  port: BackfillPort,
  input: NewCiRun,
): Promise<string | undefined> {
  try {
    return await port.createCiRun(input);
  } catch (error) {
    if (isUniqueViolation(error)) return undefined;
    throw error;
  }
}

async function resolveCiRun(
  port: BackfillPort,
  group: RunGroup,
  summary: BackfillSummary,
): Promise<string> {
  const times = group.rows.map((row) => row.startedAt.getTime());
  const startedAt = new Date(Math.min(...times));
  const lastReportedAt = new Date(Math.max(...times));
  const commit = commitFieldsOf(group.rows);

  for (let attempt = 1; attempt <= MAX_MERGE_ATTEMPTS; attempt += 1) {
    const existing = await port.findCiRun(group.key);

    if (existing === null) {
      const createdId = await createUnlessTaken(port, {
        ...group.key,
        organizationId: group.organizationId,
        startedAt,
        lastReportedAt,
        ...commit,
      });
      if (createdId !== undefined) {
        summary.ciRunsCreated += 1;
        return createdId;
      }
      continue;
    }

    const patch = patchFor(existing, startedAt, lastReportedAt, commit);
    if (patch === undefined) return existing.id;

    if (await port.updateCiRunIfUnchanged(existing, patch)) {
      summary.ciRunsUpdated += 1;
      return existing.id;
    }
  }

  const { projectId, source, externalId } = group.key;
  throw new Error(
    `Gave up on the ${source} CiRun ${externalId} of project ${projectId} after ` +
      `${MAX_MERGE_ATTEMPTS} attempts because concurrent ingestion kept ` +
      'changing it. None of its runs were linked; run the script again.',
  );
}

async function applyGroup(
  port: BackfillPort,
  group: RunGroup,
  summary: BackfillSummary,
): Promise<void> {
  const ciRunId = await resolveCiRun(port, group, summary);
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
