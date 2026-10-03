import {
  backfillCiRuns,
  type BackfillPort,
  type BackfillSummary,
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

function summaryLines(summary: BackfillSummary): string[] {
  return [
    `Scanned: ${summary.scanned}`,
    `Unattributable (left untouched): ${summary.unattributable}`,
    `CiRuns created: ${summary.ciRunsCreated}`,
    `CiRuns updated: ${summary.ciRunsUpdated}`,
    `Runs linked: ${summary.runsLinked}`,
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
      const summary = await backfillCiRuns(port);
      summaryLines(summary).forEach((line) => deps.log(line));
    } finally {
      await close();
    }

    return 0;
  } catch (error) {
    deps.logError(error);
    return 1;
  }
}
