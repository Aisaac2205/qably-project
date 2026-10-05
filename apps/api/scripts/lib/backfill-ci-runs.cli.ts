import {
  MAX_MERGE_ATTEMPTS,
  backfillCiRuns,
  type BackfillPort,
  type BackfillSummary,
  type CiRunKey,
} from './backfill-ci-runs.lib';
import { hasConfirmFlag, hostOf } from './reclassify-pending-proposals.lib';

export interface BackfillCliDeps {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  openPort: (databaseUrl: string) => {
    port: BackfillPort;
    close: () => Promise<void>;
  };
  log: (line: string) => void;
  logError: (error: unknown) => void;
}

const EXIT_SKIPPED_GROUPS = 2;

function skippedLine(key: CiRunKey): string {
  return (
    `Skipped ${key.source} CiRun ${key.externalId} of project ${key.projectId}: ` +
    `concurrent ingestion changed it in ${MAX_MERGE_ATTEMPTS} consecutive ` +
    'attempts and none of its runs were linked.'
  );
}

function skippedSummaryLines(summary: BackfillSummary): string[] {
  if (summary.skippedGroups.length === 0) return ['Skipped groups: 0'];

  return [
    `Skipped groups: ${summary.skippedGroups.length}`,
    ...summary.skippedGroups.map(
      (key) => `  ${key.source} ${key.externalId} (project ${key.projectId})`,
    ),
    'Run the script again to link the skipped groups.',
  ];
}

function summaryLines(summary: BackfillSummary): string[] {
  return [
    `Scanned: ${summary.scanned}`,
    `Unattributable (left untouched): ${summary.unattributable}`,
    `CiRuns created: ${summary.ciRunsCreated}`,
    `CiRuns updated: ${summary.ciRunsUpdated}`,
    `Runs linked: ${summary.runsLinked}`,
    `Job keys set: ${summary.jobKeysSet}`,
    `Linked runs left without a job key: ${summary.jobKeysUnresolved}`,
    ...skippedSummaryLines(summary),
  ];
}

export async function runBackfillCli(deps: BackfillCliDeps): Promise<number> {
  try {
    if (!hasConfirmFlag(deps.argv)) {
      throw new Error(
        'Refusing to run without --confirm. This links existing runs to new ' +
          'CiRun rows. Re-run with --confirm once you have verified ' +
          'DATABASE_URL points at the intended database.',
      );
    }

    const databaseUrl = deps.env.DATABASE_URL;
    if (databaseUrl === undefined || databaseUrl.trim() === '') {
      throw new Error('DATABASE_URL is required.');
    }

    deps.log(`Target database host: ${hostOf(databaseUrl)}`);

    const { port, close } = deps.openPort(databaseUrl);
    try {
      const summary = await backfillCiRuns(port, {
        onSkippedGroup: (key) => deps.log(skippedLine(key)),
      });
      summaryLines(summary).forEach((line) => deps.log(line));
      return summary.skippedGroups.length === 0 ? 0 : EXIT_SKIPPED_GROUPS;
    } finally {
      await close();
    }
  } catch (error) {
    deps.logError(error);
    return 1;
  }
}
