import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaClient } from '../../generated/prisma/client';
import { assertLocalBenchUrl } from './lib/assert-local-bench-url';
import { WARMUP_SAMPLES, MEASURED_SAMPLES } from './lib/sample-size';
import { seedReviewInboxBench } from './seed';
import { ConfigModule } from '../../src/config/config.module';
import { ENV } from '../../src/config/config.tokens';
import type { Env } from '../../src/config/env';
import { AuthModule } from '../../src/modules/auth/auth.module';
import {
  SESSION_READER,
  type SessionContext,
} from '../../src/modules/auth/auth.contracts';
import { AUTH_INSTANCE } from '../../src/modules/auth/auth.instance';
import { OrganizationsModule } from '../../src/modules/organizations/organizations.module';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { ReviewModule } from '../../src/modules/review/review.module';
import { ExtractionProcessor } from '../../src/modules/review/extraction.processor';
import { EXTRACTION_QUEUE } from '../../src/modules/review/review.contracts';
import { PROPOSAL_CLASSIFICATION_QUEUE } from '../../src/modules/proposal-classification/proposal-classification.contracts';
import { ReclassifySuiteProcessor } from '../../src/modules/proposal-classification/reclassify-suite.processor';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

function noopQueue(): { add: () => Promise<{ id: string }> } {
  return { add: () => Promise.resolve({ id: 'bench-job' }) };
}

const API_ROOT = join(__dirname, '..', '..');
const RESULTS_DIR = join(__dirname, 'results');

interface CallStats {
  label: string;
  p50: number;
  p95: number;
  max: number;
  samples: number;
}

function percentile(sorted: number[], fraction: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * fraction),
  );
  return sorted[index];
}

function summarize(label: string, durationsMs: number[]): CallStats {
  const sorted = [...durationsMs].sort((a, b) => a - b);
  return {
    label,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1],
    samples: sorted.length,
  };
}

async function timeCall(run: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await run();
  return performance.now() - start;
}

async function measure(
  label: string,
  calls: Array<() => Promise<unknown>>,
): Promise<CallStats> {
  for (let i = 0; i < WARMUP_SAMPLES && i < calls.length; i += 1) {
    await calls[i]();
  }

  const measuredCalls = calls.slice(
    WARMUP_SAMPLES,
    WARMUP_SAMPLES + MEASURED_SAMPLES,
  );
  const durations: number[] = [];
  for (const call of measuredCalls) {
    durations.push(await timeCall(call));
  }

  return summarize(label, durations);
}

function runMigrateDeploy(databaseUrl: string): void {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: API_ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    shell: true,
  });
}

function benchEnv(databaseUrl: string): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3001,
    DATABASE_URL: databaseUrl,
    REDIS_URL: 'redis://localhost:6379',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3001',
    WEB_APP_URL: 'http://localhost:3000',
    ENCRYPTION_KEY: 'a'.repeat(64),
    GITHUB_CLIENT_ID: 'bench-client-id',
    GITHUB_CLIENT_SECRET: 'bench-client-secret',
    GEMINI_MODEL: 'gemini-3.1-flash-lite',
  };
}

async function buildApp(
  databaseUrl: string,
  session: SessionContext,
): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [
      ConfigModule,
      PrismaModule,
      AuthModule,
      OrganizationsModule,
      ReviewModule,
    ],
  })
    .overrideProvider(ENV)
    .useValue(benchEnv(databaseUrl))
    .overrideProvider(AUTH_INSTANCE)
    .useValue({ handler: () => new Response('{}', { status: 200 }) })
    .overrideProvider(SESSION_READER)
    .useValue({ read: () => Promise.resolve(session) })
    .overrideProvider(getQueueToken(EXTRACTION_QUEUE))
    .useValue(noopQueue())
    .overrideProvider(ExtractionProcessor)
    .useValue({})
    .overrideProvider(getQueueToken(PROPOSAL_CLASSIFICATION_QUEUE))
    .useValue(noopQueue())
    .overrideProvider(ReclassifySuiteProcessor)
    .useValue({})
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalFilters(new AllExceptionsFilter(false));
  await app.init();
  return app;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.BENCH_DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.trim() === '') {
    throw new Error(
      'BENCH_DATABASE_URL is required. It must point at a disposable local Postgres — never DATABASE_URL from .env.',
    );
  }
  assertLocalBenchUrl(databaseUrl);

  console.log('Running prisma migrate deploy against the bench database...');
  runMigrateDeploy(databaseUrl);

  const seedClient = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  console.log('Seeding the bench database...');
  const seed = await seedReviewInboxBench(seedClient, databaseUrl);
  await seedClient.$disconnect();

  const session: SessionContext = {
    user: {
      id: seed.userId,
      email: 'review-inbox-bench@example.internal',
      name: 'Bench Runner',
      emailVerified: true,
      locale: null,
    },
    sessionId: 'bench-session',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  };

  console.log('Booting the API in-process...');
  const app = await buildApp(databaseUrl, session);
  const server = app.getHttpServer();

  const results: CallStats[] = [];

  results.push(
    await measure(
      'GET /review/proposals (no filters)',
      Array.from(
        { length: WARMUP_SAMPLES + MEASURED_SAMPLES },
        () => () => request(server).get('/review/proposals').expect(200),
      ),
    ),
  );

  results.push(
    await measure(
      'GET /review/proposals?status=in_review',
      Array.from(
        { length: WARMUP_SAMPLES + MEASURED_SAMPLES },
        () => () =>
          request(server).get('/review/proposals?status=in_review').expect(200),
      ),
    ),
  );

  results.push(
    await measure(
      'GET /review/proposals?search=bench',
      Array.from(
        { length: WARMUP_SAMPLES + MEASURED_SAMPLES },
        () => () =>
          request(server).get('/review/proposals?search=bench').expect(200),
      ),
    ),
  );

  results.push(
    await measure(
      'GET /review/inbox (default in_review)',
      Array.from(
        { length: WARMUP_SAMPLES + MEASURED_SAMPLES },
        () => () => request(server).get('/review/inbox').expect(200),
      ),
    ),
  );

  results.push(
    await measure(
      'GET /review/inbox?search=bench',
      Array.from(
        { length: WARMUP_SAMPLES + MEASURED_SAMPLES },
        () => () =>
          request(server).get('/review/inbox?search=bench').expect(200),
      ),
    ),
  );

  results.push(
    await measure(
      'GET /review/inbox?duplicatesOnly=true',
      Array.from(
        { length: WARMUP_SAMPLES + MEASURED_SAMPLES },
        () => () =>
          request(server).get('/review/inbox?duplicatesOnly=true').expect(200),
      ),
    ),
  );

  results.push(
    await measure(
      'GET /review/inbox/counts',
      Array.from(
        { length: WARMUP_SAMPLES + MEASURED_SAMPLES },
        () => () => request(server).get('/review/inbox/counts').expect(200),
      ),
    ),
  );

  const approveIds = seed.inReviewProposalIds;
  if (approveIds.length < WARMUP_SAMPLES + MEASURED_SAMPLES) {
    throw new Error(
      `Seed produced only ${approveIds.length} in_review proposals; need at least ${WARMUP_SAMPLES + MEASURED_SAMPLES} distinct ids to bench approve.`,
    );
  }
  results.push(
    await measure(
      'POST /review/proposals/:id/approve',
      approveIds.map(
        (id) => () =>
          request(server)
            .post(`/review/proposals/${id}/approve`)
            .send({})
            .expect(201),
      ),
    ),
  );

  await app.close();

  mkdirSync(RESULTS_DIR, { recursive: true });
  const label = process.argv[2] ?? 'baseline';
  const outputPath = join(RESULTS_DIR, `${label}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.table(results);
  console.log(`Results written to ${outputPath}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
