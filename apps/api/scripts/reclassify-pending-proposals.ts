import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { Queue } from 'bullmq';
import { PrismaClient } from '../generated/prisma/client';
import { buildJobId } from '../src/common/queue/job-id';
import {
  PROPOSAL_CLASSIFICATION_QUEUE,
  RECLASSIFY_SUITE_JOB,
  type ReclassifySuiteJobData,
} from '../src/modules/proposal-classification/proposal-classification.contracts';
import {
  extractSuiteIds,
  hasConfirmFlag,
  hostOf,
} from './lib/reclassify-pending-proposals.lib';

async function main(): Promise<void> {
  if (!hasConfirmFlag(process.argv)) {
    throw new Error(
      'Refusing to run without --confirm. This enqueues a reclassify job for ' +
        'every suite that currently has in_review proposals. Re-run with ' +
        '--confirm once you have verified DATABASE_URL points at the ' +
        'intended database.',
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL is required.');
  }

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl === undefined || redisUrl.trim() === '') {
    throw new Error('REDIS_URL is required.');
  }

  console.log(`Target database host: ${hostOf(databaseUrl)}`);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const queue = new Queue<ReclassifySuiteJobData>(
    PROPOSAL_CLASSIFICATION_QUEUE,
    { connection: { url: redisUrl } },
  );

  try {
    const rows = await prisma.extractedProposal.findMany({
      where: { status: 'in_review', suiteId: { not: null } },
      select: { suiteId: true },
      distinct: ['suiteId'],
    });
    const suiteIds = extractSuiteIds(rows);

    console.log(`Found ${suiteIds.length} suite(s) with in_review proposals.`);

    for (const suiteId of suiteIds) {
      await queue.add(
        RECLASSIFY_SUITE_JOB,
        { suiteId },
        {
          deduplication: {
            id: buildJobId('reclassify', [suiteId]),
            keepLastIfActive: true,
          },
        },
      );
    }

    console.log(
      `Enqueued ${suiteIds.length} reclassify job(s). Idempotent — safe to re-run.`,
    );
  } finally {
    await queue.close();
    await prisma.$disconnect();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
