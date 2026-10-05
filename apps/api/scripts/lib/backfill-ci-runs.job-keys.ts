import { resolveCiJobKey } from '../../src/modules/runs/lib/ci-external-id';

export interface RunMissingJobKey {
  id: string;
  projectId: string;
  externalId: string | null;
  ciRunExternalId: string;
}

export interface JobKeyPort {
  readKnownJobKeys(projectId: string): Promise<readonly string[]>;
  readRunsMissingJobKey(
    afterId: string | undefined,
    take: number,
  ): Promise<RunMissingJobKey[]>;
  setJobKey(runIds: readonly string[], ciJobKey: string): Promise<number>;
}

export interface JobKeyStats {
  jobKeysSet: number;
  jobKeysUnresolved: number;
}

async function knownKeysOf(
  port: JobKeyPort,
  cache: Map<string, readonly string[]>,
  projectId: string,
): Promise<readonly string[]> {
  const cached = cache.get(projectId);
  if (cached !== undefined) return cached;

  const keys = await port.readKnownJobKeys(projectId);
  cache.set(projectId, keys);
  return keys;
}

export async function recoverJobKeys(
  port: JobKeyPort,
  batchSize: number,
): Promise<JobKeyStats> {
  const stats: JobKeyStats = { jobKeysSet: 0, jobKeysUnresolved: 0 };
  const cache = new Map<string, readonly string[]>();

  let batch = await port.readRunsMissingJobKey(undefined, batchSize);
  while (batch.length > 0) {
    const idsByKey = new Map<string, string[]>();

    for (const row of batch) {
      const known = await knownKeysOf(port, cache, row.projectId);
      const key = resolveCiJobKey(row.externalId, row.ciRunExternalId, known);

      if (key === undefined) {
        stats.jobKeysUnresolved += 1;
        continue;
      }
      idsByKey.set(key, [...(idsByKey.get(key) ?? []), row.id]);
    }

    for (const [key, ids] of idsByKey) {
      stats.jobKeysSet += await port.setJobKey(ids, key);
    }

    batch = await port.readRunsMissingJobKey(
      batch[batch.length - 1].id,
      batchSize,
    );
  }

  return stats;
}
