/**
 * How a snapshot came to exist. `ingest` is the exact content read from the
 * catalog when the run was reported. `backfill` is the last published version
 * in force when the run started, filled in afterwards for a row recorded before
 * snapshots existed: an approximation, because content edited in place after a
 * publish belongs to no version and cannot be reconstructed.
 */
export type CatalogSnapshotOrigin = 'ingest' | 'backfill';

const SNAPSHOT_ORIGINS: readonly CatalogSnapshotOrigin[] = [
  'ingest',
  'backfill',
];

/**
 * The catalog content a run case executed against, stored inline on the run
 * case so a finished run keeps showing it after the catalog case is edited or
 * deleted. `version` is the number of the catalog version in force at the time,
 * or null when the case had none (a draft, or a case never approved).
 * `origin` is absent on snapshots written before the marker existed.
 */
export type RunCaseCatalogSnapshot = {
  name: string;
  steps: string[];
  expectedResult: string;
  version: number | null;
  origin?: CatalogSnapshotOrigin;
};

/** The columns of a catalog case a snapshot is built from. */
export interface CatalogCaseContent {
  name: string;
  steps: string[];
  expectedResult: string;
  currentVersionId: string | null;
  currentVersion: { version: number } | null;
}

export const CATALOG_CONTENT_SELECT = {
  id: true,
  name: true,
  steps: true,
  expectedResult: true,
  currentVersionId: true,
  currentVersion: { select: { version: true } },
} as const;

export function buildCatalogSnapshot(
  catalogCase: CatalogCaseContent,
): RunCaseCatalogSnapshot {
  return {
    name: catalogCase.name,
    steps: [...catalogCase.steps],
    expectedResult: catalogCase.expectedResult,
    version: catalogCase.currentVersion?.version ?? null,
    origin: 'ingest',
  };
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isVersionNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function isSnapshotOrigin(value: unknown): value is CatalogSnapshotOrigin {
  return SNAPSHOT_ORIGINS.some((origin) => origin === value);
}

/**
 * Reads a stored snapshot defensively. The column is untyped JSON, so anything
 * that is not exactly the snapshot shape yields null and the caller falls back
 * to the live catalog; it never throws and never echoes unknown fields back.
 */
export function parseCatalogSnapshot(
  value: unknown,
): RunCaseCatalogSnapshot | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  try {
    const { name, steps, expectedResult, version, origin } = value as Record<
      string,
      unknown
    >;

    if (typeof name !== 'string') return null;
    if (!isStringArray(steps)) return null;
    if (typeof expectedResult !== 'string') return null;
    if (version !== null && !isVersionNumber(version)) return null;
    if (origin !== undefined && !isSnapshotOrigin(origin)) return null;

    return {
      name,
      steps: [...steps],
      expectedResult,
      version,
      ...(origin === undefined ? {} : { origin }),
    };
  } catch {
    return null;
  }
}

/** What a run case records about the catalog case it executed. */
export interface ExecutedCatalog {
  testCaseVersionId: string | null;
  snapshot: RunCaseCatalogSnapshot;
}

/** The catalog columns of a run case that a re-report is about to replace. */
export interface PreviousRunCaseCatalog {
  testCaseId: string | null;
  testCaseVersionId: string | null;
  catalogSnapshot: unknown;
}

/**
 * Decides, per catalog case, the content a run records as executed. A first
 * report snapshots the catalog as it stands. A re-report of the same run keeps
 * the snapshot the run already holds, so a late re-send never replaces "as
 * executed" with newer content; when a case repeats, the first valid snapshot
 * wins. Previous rows without a usable snapshot (recorded before snapshots
 * existed, or malformed) are treated as never snapshotted.
 */
export function resolveExecutedCatalog(
  current: ReadonlyMap<string, CatalogCaseContent>,
  previous: readonly PreviousRunCaseCatalog[],
): Map<string, ExecutedCatalog> {
  const executed = new Map<string, ExecutedCatalog>();

  for (const [testCaseId, catalogCase] of current) {
    executed.set(testCaseId, {
      testCaseVersionId: catalogCase.currentVersionId,
      snapshot: buildCatalogSnapshot(catalogCase),
    });
  }

  const reused = new Set<string>();

  for (const row of previous) {
    if (row.testCaseId === null || reused.has(row.testCaseId)) continue;

    const snapshot = parseCatalogSnapshot(row.catalogSnapshot);

    if (snapshot === null) continue;

    reused.add(row.testCaseId);
    executed.set(row.testCaseId, {
      testCaseVersionId: row.testCaseVersionId,
      snapshot,
    });
  }

  return executed;
}

/**
 * The two `run_case` columns that record the executed catalog content. A case
 * with nothing to record leaves the snapshot out entirely, because a nullable
 * JSON column cannot be set to a bare null through Prisma.
 */
export function toCatalogColumns(executed: ExecutedCatalog | undefined): {
  testCaseVersionId: string | null;
  catalogSnapshot?: RunCaseCatalogSnapshot;
} {
  if (executed === undefined) return { testCaseVersionId: null };

  return {
    testCaseVersionId: executed.testCaseVersionId,
    catalogSnapshot: executed.snapshot,
  };
}
