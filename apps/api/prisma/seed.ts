import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const SEED_ORG_SLUG = 'qably-dashboard-seed';
const SEED_ORG_NAME = 'Dashboard Seed Org';
const SEED_USER_EMAIL = 'qably.dashboard.seed@example.com';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_IN_MS);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * (DAY_IN_MS / 24));
}

function guardAgainstProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV=production. Zero rows written.');
    process.exit(1);
  }
}

async function seed(prisma: PrismaClient): Promise<void> {
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: SEED_ORG_SLUG },
    select: { id: true },
  });

  if (existingOrg !== null) {
    console.log(
      `Seed org "${SEED_ORG_SLUG}" already exists (id: ${existingOrg.id}) — skipping, zero rows created.`,
    );
    return;
  }

  const user = await prisma.user.create({
    data: {
      name: 'Dashboard Seed Bot',
      email: SEED_USER_EMAIL,
      emailVerified: true,
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: SEED_ORG_NAME,
      slug: SEED_ORG_SLUG,
      plan: 'equipo',
      maxProjects: 20,
      maxUsers: 10,
      maxCases: 1000,
    },
  });

  await prisma.orgMember.create({
    data: { organizationId: org.id, userId: user.id, role: 'owner' },
  });

  const checkout = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Seed Checkout Flow',
      description: 'Seeded project — checkout regression suite',
      technologies: ['typescript', 'playwright'],
    },
  });
  const payment = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Seed Payment Gateway',
      description: 'Seeded project — payment provider integration',
      technologies: ['typescript', 'jest'],
    },
  });
  const notifications = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Seed Notification Service',
      description: 'Seeded project — email and webhook delivery',
      technologies: ['node'],
    },
  });
  const search = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Seed Search Indexer',
      description: 'Seeded project — search index rebuilds',
      technologies: ['elasticsearch'],
    },
  });
  const reporting = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Seed Reporting Dashboard',
      description: 'Seeded project — internal reporting views',
      technologies: ['react'],
    },
  });
  const legacyArchive = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Seed Legacy Archive',
      description: 'Seeded project — decommissioned, never run',
      technologies: [],
    },
  });

  const checkoutSuite = await prisma.suite.create({
    data: {
      projectId: checkout.id,
      organizationId: org.id,
      name: 'Checkout regression',
    },
  });
  const paymentSuite = await prisma.suite.create({
    data: {
      projectId: payment.id,
      organizationId: org.id,
      name: 'Payment provider',
    },
  });
  const notificationsSuite = await prisma.suite.create({
    data: {
      projectId: notifications.id,
      organizationId: org.id,
      name: 'Delivery pipeline',
    },
  });
  const searchSuite = await prisma.suite.create({
    data: {
      projectId: search.id,
      organizationId: org.id,
      name: 'Index rebuild',
    },
  });
  const reportingSuite = await prisma.suite.create({
    data: {
      projectId: reporting.id,
      organizationId: org.id,
      name: 'Report generation',
    },
  });
  const legacySuite = await prisma.suite.create({
    data: {
      projectId: legacyArchive.id,
      organizationId: org.id,
      name: 'Archived checks',
    },
  });

  async function createCases(
    suiteId: string,
    projectId: string,
    names: string[],
  ): Promise<{ id: string; name: string }[]> {
    const cases: { id: string; name: string }[] = [];
    for (const [index, name] of names.entries()) {
      const testCase = await prisma.testCase.create({
        data: {
          suiteId,
          projectId,
          name,
          objective: `Verify ${name.toLowerCase()}`,
          position: index,
        },
        select: { id: true, name: true },
      });
      cases.push(testCase);
    }
    return cases;
  }

  const checkoutCases = await createCases(checkoutSuite.id, checkout.id, [
    'Guest can complete checkout',
    'Coupon discount applies correctly',
    'Payment failure shows retry',
    'Order confirmation email queued',
    'Cart persists across reload',
  ]);
  const paymentCases = await createCases(paymentSuite.id, payment.id, [
    'Card charge succeeds',
    'Declined card surfaces error',
    'Refund reverses charge',
    'Webhook signature validated',
    'Idempotency key prevents double charge',
  ]);
  const notificationCases = await createCases(
    notificationsSuite.id,
    notifications.id,
    [
      'Email delivery queued',
      'Slack webhook fires on failure',
      'Digest batches pending notifications',
    ],
  );
  const searchCases = await createCases(searchSuite.id, search.id, [
    'Index rebuild completes',
    'Stale documents purged',
  ]);
  const reportingCases = await createCases(reportingSuite.id, reporting.id, [
    'Weekly report renders',
    'Export downloads as CSV',
  ]);
  await createCases(legacySuite.id, legacyArchive.id, ['Archived smoke check']);

  interface CaseOutcome {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'pass' | 'fail' | 'skip' | 'blocked';
  }

  async function createRun(options: {
    projectId: string;
    suiteId: string;
    suiteName: string;
    name: string;
    status: 'pending' | 'running' | 'pass' | 'fail';
    externalId: string;
    startedAt: Date;
    finished: boolean;
    cases: CaseOutcome[];
  }): Promise<void> {
    const run = await prisma.run.create({
      data: {
        projectId: options.projectId,
        organizationId: org.id,
        suiteId: options.suiteId,
        name: options.name,
        status: options.status,
        source: 'api',
        externalId: options.externalId,
        startedAt: options.startedAt,
        finishedAt: options.finished
          ? new Date(options.startedAt.getTime() + 6 * 60 * 1000)
          : null,
      },
      select: { id: true },
    });

    await prisma.runCase.createMany({
      data: options.cases.map((testCase, index) => ({
        runId: run.id,
        testCaseId: testCase.id,
        name: testCase.name,
        suiteName: options.suiteName,
        status: testCase.status,
        position: index,
        recordedAt: options.finished ? options.startedAt : null,
      })),
    });
  }

  function withStatuses(
    cases: { id: string; name: string }[],
    statuses: CaseOutcome['status'][],
  ): CaseOutcome[] {
    return cases.map((testCase, index) => ({
      ...testCase,
      status: statuses[index % statuses.length],
    }));
  }

  await createRun({
    projectId: checkout.id,
    suiteId: checkoutSuite.id,
    suiteName: checkoutSuite.name,
    name: 'Checkout nightly run',
    status: 'pass',
    externalId: 'seed-run-checkout-1',
    startedAt: hoursAgo(24),
    finished: true,
    cases: withStatuses(checkoutCases, ['pass']),
  });

  await createRun({
    projectId: checkout.id,
    suiteId: checkoutSuite.id,
    suiteName: checkoutSuite.name,
    name: 'Checkout regression run',
    status: 'fail',
    externalId: 'seed-run-checkout-0',
    startedAt: daysAgo(3),
    finished: true,
    cases: withStatuses(checkoutCases, [
      'pass',
      'fail',
      'fail',
      'pass',
      'fail',
    ]),
  });

  await createRun({
    projectId: payment.id,
    suiteId: paymentSuite.id,
    suiteName: paymentSuite.name,
    name: 'Payment provider run',
    status: 'fail',
    externalId: 'seed-run-payment-1',
    startedAt: hoursAgo(12),
    finished: true,
    cases: withStatuses(paymentCases, ['pass', 'fail', 'pass', 'fail', 'pass']),
  });

  await createRun({
    projectId: notifications.id,
    suiteId: notificationsSuite.id,
    suiteName: notificationsSuite.name,
    name: 'Notification delivery run',
    status: 'running',
    externalId: 'seed-run-notifications-1',
    startedAt: hoursAgo(3),
    finished: false,
    cases: withStatuses(notificationCases, ['pass', 'running', 'pending']),
  });

  await createRun({
    projectId: search.id,
    suiteId: searchSuite.id,
    suiteName: searchSuite.name,
    name: 'Search index rebuild run',
    status: 'pending',
    externalId: 'seed-run-search-1',
    startedAt: daysAgo(6),
    finished: false,
    cases: withStatuses(searchCases, ['pending', 'pending']),
  });

  await createRun({
    projectId: reporting.id,
    suiteId: reportingSuite.id,
    suiteName: reportingSuite.name,
    name: 'Report generation run',
    status: 'pass',
    externalId: 'seed-run-reporting-1',
    startedAt: daysAgo(5),
    finished: true,
    cases: withStatuses(reportingCases, ['pass']),
  });

  const scmBackdate = daysAgo(10);

  await prisma.ingestionBatch.create({
    data: {
      projectId: checkout.id,
      source: 'REPOSITORY',
      status: 'FAILED',
      createdAt: scmBackdate,
    },
  });
  await prisma.ingestionBatch.create({
    data: {
      projectId: payment.id,
      source: 'REPOSITORY',
      status: 'COMPLETED',
      createdAt: scmBackdate,
    },
  });

  const staleEvidence = await prisma.evidence.create({
    data: {
      projectId: checkout.id,
      kind: 'SOURCE_EXCERPT',
      title: 'Checkout retry handler diff',
      uri: 'seed://evidence/checkout-retry-handler',
      excerpt: 'if (charge.status === "declined") { retry(charge); }',
      createdAt: daysAgo(10),
    },
  });
  await prisma.extractedProposal.create({
    data: {
      projectId: checkout.id,
      evidenceId: staleEvidence.id,
      status: 'in_review',
      title: 'Cover declined-charge retry path',
      objective: 'Verify the retry handler re-attempts a declined charge',
      createdAt: daysAgo(10),
    },
  });

  const freshEvidence = await prisma.evidence.create({
    data: {
      projectId: payment.id,
      kind: 'SOURCE_EXCERPT',
      title: 'Webhook signature check diff',
      uri: 'seed://evidence/payment-webhook-signature',
      excerpt: 'verifySignature(payload, header);',
      createdAt: daysAgo(1),
    },
  });
  await prisma.extractedProposal.create({
    data: {
      projectId: payment.id,
      evidenceId: freshEvidence.id,
      status: 'in_review',
      title: 'Cover webhook signature verification',
      objective: 'Verify an invalid signature is rejected',
      createdAt: daysAgo(1),
    },
  });

  console.log(`Seeded org "${SEED_ORG_NAME}" (${org.id}):`);
  console.log('  6 projects (5 with runs, 1 with zero runs — activity null)');
  console.log('  6 suites, 18 test cases');
  console.log('  6 runs spanning the last 7 days with mixed statuses');
  console.log(
    '  2 ingestion batches backdated 10 days (1 FAILED, scm stage idle in-window)',
  );
  console.log('  2 in_review proposals (1 stale > 7 days, 1 fresh)');
}

async function main(): Promise<void> {
  guardAgainstProduction();

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    console.error('Refusing to seed: DATABASE_URL is not set.');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
