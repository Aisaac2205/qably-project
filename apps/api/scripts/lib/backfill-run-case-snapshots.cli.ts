import {
  backfillRunCaseSnapshots,
  type BatchProgress,
  type SnapshotBackfillPort,
  type SnapshotBackfillSummary,
} from './backfill-run-case-snapshots.lib';
import { hasConfirmFlag, hostOf } from './reclassify-pending-proposals.lib';

export interface SnapshotBackfillCliDeps {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  openPort: (databaseUrl: string) => {
    port: SnapshotBackfillPort;
    close: () => Promise<void>;
  };
  log: (line: string) => void;
  logError: (error: unknown) => void;
}

function batchLine(progress: BatchProgress, apply: boolean): string {
  const outcome = apply
    ? `filled ${progress.filled}`
    : `${progress.eligible} would be filled`;

  return (
    `Batch ${progress.batch}: read ${progress.read}, ${outcome} ` +
    `(${progress.scanned} scanned)`
  );
}

function summaryLines(summary: SnapshotBackfillSummary): string[] {
  const lines = [
    `Already have a snapshot (left untouched): ${summary.alreadySnapshotted}`,
    `Run cases without a snapshot: ${summary.scanned}`,
    summary.apply
      ? `Filled: ${summary.filled}`
      : `Would fill: ${summary.eligible}`,
    `No version in force when the run started (left untouched): ${summary.noVersionInForce}`,
    `No linked case (left untouched): ${summary.noLinkedCase}`,
  ];

  if (summary.apply) {
    lines.push(
      `Changed since they were read (not written): ${summary.changedSinceRead}`,
    );
  } else {
    lines.push(
      'Dry run: nothing was written. Re-run with --confirm to fill the rows above.',
    );
  }

  return lines;
}

export async function runSnapshotBackfillCli(
  deps: SnapshotBackfillCliDeps,
): Promise<number> {
  try {
    const apply = hasConfirmFlag(deps.argv);

    if (apply && deps.argv.includes('--dry-run')) {
      throw new Error(
        'Refusing to run with both --dry-run and --confirm: they ask for ' +
          'opposite things. Pass --confirm to write, or neither flag for a ' +
          'dry run.',
      );
    }

    const databaseUrl = deps.env.DATABASE_URL;
    if (databaseUrl === undefined || databaseUrl.trim() === '') {
      throw new Error('DATABASE_URL is required.');
    }

    deps.log(`Target database host: ${hostOf(databaseUrl)}`);
    deps.log(apply ? 'Mode: apply' : 'Mode: dry run, nothing is written');

    const { port, close } = deps.openPort(databaseUrl);
    try {
      const summary = await backfillRunCaseSnapshots(port, {
        apply,
        onBatch: (progress) => deps.log(batchLine(progress, apply)),
      });
      summaryLines(summary).forEach((line) => deps.log(line));
      return 0;
    } finally {
      await close();
    }
  } catch (error) {
    deps.logError(error);
    return 1;
  }
}
