import type { PrismaClient } from '../../generated/prisma/client';
import { assertLocalBenchUrl } from './lib/assert-local-bench-url';
import { TOTAL_SAMPLES } from './lib/sample-size';

const BENCH_ORG_SLUG = 'review-inbox-bench';
const BENCH_ORG_NAME = 'Review Inbox Bench Org';
const BENCH_USER_EMAIL = 'review-inbox-bench@example.internal';

const PROJECT_COUNT = 3;
const SUITE_COUNT = 10;
const CASE_COUNT = 1_500;
const IN_REVIEW_COUNT = 1_000;
const DECIDED_COUNT = 2_000;
const CREATE_MANY_CHUNK = 500;
const APPROVE_SAMPLE_SIZE = TOTAL_SAMPLES;

export interface BenchSeedResult {
  organizationId: string;
  userId: string;
  projectIds: string[];
  inReviewProposalIds: string[];
}

async function chunkedCreateMany<T>(
  create: (batch: T[]) => Promise<unknown>,
  rows: T[],
): Promise<void> {
  for (let start = 0; start < rows.length; start += CREATE_MANY_CHUNK) {
    await create(rows.slice(start, start + CREATE_MANY_CHUNK));
  }
}

export async function seedReviewInboxBench(
  prisma: PrismaClient,
  databaseUrl: string,
): Promise<BenchSeedResult> {
  assertLocalBenchUrl(databaseUrl);

  await prisma.organization.deleteMany({ where: { slug: BENCH_ORG_SLUG } });

  const organization = await prisma.organization.create({
    data: { name: BENCH_ORG_NAME, slug: BENCH_ORG_SLUG },
  });

  const user = await prisma.user.upsert({
    where: { email: BENCH_USER_EMAIL },
    update: {},
    create: {
      name: 'Bench Runner',
      email: BENCH_USER_EMAIL,
      emailVerified: true,
    },
  });

  await prisma.orgMember.create({
    data: { organizationId: organization.id, userId: user.id, role: 'owner' },
  });

  const projects = await Promise.all(
    Array.from({ length: PROJECT_COUNT }, (_, index) =>
      prisma.project.create({
        data: {
          organizationId: organization.id,
          name: `Bench Project ${index + 1}`,
        },
      }),
    ),
  );

  const evidences = await Promise.all(
    projects.map((project) =>
      prisma.evidence.create({
        data: {
          projectId: project.id,
          kind: 'SOURCE_EXCERPT',
          title: 'bench-evidence.spec.ts',
          uri: 'https://example.test/bench-evidence.spec.ts',
          excerpt: 'it("does something", () => {})',
        },
      }),
    ),
  );

  const suites: Awaited<ReturnType<PrismaClient['suite']['create']>>[] = [];
  for (let index = 0; index < SUITE_COUNT; index += 1) {
    const project = projects[index % PROJECT_COUNT];
    suites.push(
      await prisma.suite.create({
        data: {
          projectId: project.id,
          organizationId: organization.id,
          name: `Bench Suite ${index + 1}`,
        },
      }),
    );
  }

  const caseRows = Array.from({ length: CASE_COUNT }, (_, index) => {
    const suite = suites[index % SUITE_COUNT];
    return {
      suiteId: suite.id,
      projectId: suite.projectId,
      name: `Bench case ${index + 1}`,
      steps: ['Open the page', 'Assert the result'],
      expectedResult: 'The expected result holds',
    };
  });
  await chunkedCreateMany(
    (batch) => prisma.testCase.createMany({ data: batch }),
    caseRows,
  );

  const inReviewRows = Array.from({ length: IN_REVIEW_COUNT }, (_, index) => {
    const project = projects[index % PROJECT_COUNT];
    const evidence = evidences[index % PROJECT_COUNT];
    return {
      projectId: project.id,
      evidenceId: evidence.id,
      status: 'in_review' as const,
      title: `Bench proposal ${index + 1}`,
      objective: 'Confirm the bench flow still works',
      steps: ['Open the page', 'Assert the result'],
      expectedResult: 'The bench assertion passes',
    };
  });
  await chunkedCreateMany(
    (batch) => prisma.extractedProposal.createMany({ data: batch }),
    inReviewRows,
  );

  const decidedRows = Array.from({ length: DECIDED_COUNT }, (_, index) => {
    const project = projects[index % PROJECT_COUNT];
    const evidence = evidences[index % PROJECT_COUNT];
    return {
      projectId: project.id,
      evidenceId: evidence.id,
      status: index % 2 === 0 ? ('approved' as const) : ('rejected' as const),
      title: `Bench decided proposal ${index + 1}`,
      objective: 'Already resolved during a prior review cycle',
      steps: ['Open the page', 'Assert the result'],
      expectedResult: 'The bench assertion passes',
    };
  });
  await chunkedCreateMany(
    (batch) => prisma.extractedProposal.createMany({ data: batch }),
    decidedRows,
  );

  const approveTargets = await prisma.extractedProposal.findMany({
    where: {
      projectId: { in: projects.map((project) => project.id) },
      status: 'in_review',
    },
    select: { id: true },
    take: APPROVE_SAMPLE_SIZE,
  });

  return {
    organizationId: organization.id,
    userId: user.id,
    projectIds: projects.map((project) => project.id),
    inReviewProposalIds: approveTargets.map((row) => row.id),
  };
}
