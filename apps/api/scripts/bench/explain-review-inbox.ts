import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { assertLocalBenchUrl } from './lib/assert-local-bench-url';
import { seedReviewInboxBench } from './seed';

const API_ROOT = join(__dirname, '..', '..');
const RESULTS_DIR = join(__dirname, 'results');

interface ExplainCase {
  label: string;
  sql: string;
  params: unknown[];
}

function runMigrateDeploy(databaseUrl: string): void {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: API_ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    shell: true,
  });
}

function buildCases(organizationId: string, projectId: string): ExplainCase[] {
  return [
    {
      label: 'inbox-page-org-wide (no projectId, status=in_review)',
      sql: `EXPLAIN (ANALYZE, BUFFERS)
        SELECT ep.* FROM "extracted_proposal" ep
        JOIN "project" p ON p.id = ep."projectId"
        WHERE p."organizationId" = $1 AND ep.status = 'in_review'
        ORDER BY ep."createdAt" DESC, ep.id DESC
        LIMIT 51`,
      params: [organizationId],
    },
    {
      label: 'inbox-page-with-projectId (status=in_review)',
      sql: `EXPLAIN (ANALYZE, BUFFERS)
        SELECT ep.* FROM "extracted_proposal" ep
        WHERE ep."projectId" = $1 AND ep.status = 'in_review'
        ORDER BY ep."createdAt" DESC, ep.id DESC
        LIMIT 51`,
      params: [projectId],
    },
    {
      label:
        'inbox-page-org-wide-rewrite (projectId IN subquery, status=in_review)',
      sql: `EXPLAIN (ANALYZE, BUFFERS)
        SELECT ep.* FROM "extracted_proposal" ep
        WHERE ep."projectId" IN (
          SELECT id FROM "project" WHERE "organizationId" = $1
        ) AND ep.status = 'in_review'
        ORDER BY ep."createdAt" DESC, ep.id DESC
        LIMIT 51`,
      params: [organizationId],
    },
    {
      label: 'counts-no-search',
      sql: `EXPLAIN (ANALYZE, BUFFERS)
        SELECT ep.status, COUNT(*), MAX(ep."updatedAt")
        FROM "extracted_proposal" ep
        JOIN "project" p ON p.id = ep."projectId"
        WHERE p."organizationId" = $1
        GROUP BY ep.status`,
      params: [organizationId],
    },
    {
      label: 'counts-with-search',
      sql: `EXPLAIN (ANALYZE, BUFFERS)
        SELECT ep.status, COUNT(*), MAX(ep."updatedAt")
        FROM "extracted_proposal" ep
        JOIN "project" p ON p.id = ep."projectId"
        WHERE p."organizationId" = $1
          AND (ep.title ILIKE '%bench%' OR ep.objective ILIKE '%bench%')
        GROUP BY ep.status`,
      params: [organizationId],
    },
    {
      label: 'legacy-list-no-filters',
      sql: `EXPLAIN (ANALYZE, BUFFERS)
        SELECT ep.* FROM "extracted_proposal" ep
        JOIN "project" p ON p.id = ep."projectId"
        WHERE p."organizationId" = $1
        ORDER BY ep."createdAt" DESC`,
      params: [organizationId],
    },
    {
      label: 'legacy-list-status-in_review',
      sql: `EXPLAIN (ANALYZE, BUFFERS)
        SELECT ep.* FROM "extracted_proposal" ep
        JOIN "project" p ON p.id = ep."projectId"
        WHERE p."organizationId" = $1 AND ep.status = 'in_review'
        ORDER BY ep."createdAt" DESC`,
      params: [organizationId],
    },
  ];
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

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  console.log('Seeding the bench database (bench org + multi-tenant noise)...');
  const seed = await seedReviewInboxBench(prisma, databaseUrl);
  const projectId = seed.projectIds[0];
  if (projectId === undefined) {
    throw new Error('Seed produced no projects for the bench org.');
  }

  const cases = buildCases(seed.organizationId, projectId);
  const output: string[] = [];

  for (const explainCase of cases) {
    console.log(`\n=== ${explainCase.label} ===`);
    const rows = await prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
      explainCase.sql,
      ...explainCase.params,
    );
    const plan = rows.map((row) => row['QUERY PLAN']).join('\n');
    console.log(plan);
    output.push(`=== ${explainCase.label} ===\n${plan}\n`);
  }

  await prisma.$disconnect();

  mkdirSync(RESULTS_DIR, { recursive: true });
  const label = process.argv[2] ?? 'explain';
  const outputPath = join(RESULTS_DIR, `${label}.txt`);
  writeFileSync(outputPath, output.join('\n'));
  console.log(`\nResults written to ${outputPath}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
