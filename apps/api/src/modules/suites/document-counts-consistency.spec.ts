import type { OrgContext } from '../organizations/organizations.contracts';
import { ExtractionService } from '../review/extraction.service';
import { SuitesService } from './suites.service';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'owner',
};

function suiteCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case-x',
    suiteId: 'suite-1',
    name: 'Case',
    steps: [] as string[],
    expectedResult: '',
    priority: 'medium' as const,
    state: 'active' as const,
    currentVersion: null as { version: number; locale?: string | null } | null,
    executionMode: 'automated' as const,
    automationKey: 'key-x',
    automationClassName: null,
    automationFilePath: 'src/case-x.spec.ts',
    ...overrides,
  };
}

const eligibleCase1 = suiteCase({ id: 'eligible-1', automationKey: 'key-1' });
const eligibleCase2 = suiteCase({ id: 'eligible-2', automationKey: 'key-2' });
const pendingCase = suiteCase({ id: 'pending-1', automationKey: 'key-3' });
const noKeyCase = suiteCase({
  id: 'no-key-1',
  automationKey: null,
  automationFilePath: null,
});
const manualCase = suiteCase({
  id: 'manual-1',
  executionMode: 'manual' as const,
  automationKey: null,
  automationFilePath: null,
});

const cases = [
  eligibleCase1,
  eligibleCase2,
  pendingCase,
  noKeyCase,
  manualCase,
];

function buildSuitesService() {
  const prisma = {
    suite: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'suite-1',
        projectId: 'project-1',
        organizationId: 'org-1',
        name: 'Checkout',
        description: '',
        tags: [],
        isDefault: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        cases,
      }),
    },
    runCase: { findMany: jest.fn().mockResolvedValue([]) },
    extractedProposal: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 'proposal-1', targetTestCaseId: 'pending-1' },
        ]),
    },
    testCase: { findMany: jest.fn().mockResolvedValue([]) },
    orgMember: {
      findFirst: jest.fn().mockResolvedValue({ user: { locale: 'en' } }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  return new SuitesService(prisma as never);
}

function buildExtractionService() {
  const prisma = {
    suite: {
      findFirst: jest.fn().mockResolvedValue({ id: 'suite-1' }),
    },
    project: { findFirst: jest.fn() },
    testCase: {
      findMany: jest.fn().mockResolvedValue(
        cases.map((testCase) => ({
          id: testCase.id,
          projectId: 'project-1',
          automationKey: testCase.automationKey,
          automationFilePath: testCase.automationFilePath,
          steps: testCase.steps,
          currentVersion: testCase.currentVersion,
          executionMode: testCase.executionMode,
        })),
      ),
    },
    extractedProposal: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ targetTestCaseId: 'pending-1' }]),
    },
    orgMember: {
      findFirst: jest.fn().mockResolvedValue({ user: { locale: 'en' } }),
    },
  };

  const queue = { add: jest.fn(), addBulk: jest.fn().mockResolvedValue([]) };

  return new ExtractionService(prisma as never, queue as never);
}

describe('suite documentation counts match the enqueue outcome', () => {
  it('undocumentedCount equals casesTargeted for the same fixture, excluding pending proposals and cases with no automation key', async () => {
    const suitesService = buildSuitesService();
    const extractionService = buildExtractionService();

    const suiteResult = await suitesService.findOne(org, 'suite-1');
    const enqueueResult = await extractionService.enqueueDocumentFiles(
      org,
      { suiteId: 'suite-1' },
      null,
      'undocumented',
    );

    expect(suiteResult.ok).toBe(true);
    expect(enqueueResult.ok).toBe(true);
    if (!suiteResult.ok || !enqueueResult.ok) return;

    expect(suiteResult.value.undocumentedCount).toBe(2);
    expect(enqueueResult.value.casesTargeted).toBe(2);
    expect(suiteResult.value.undocumentedCount).toBe(
      enqueueResult.value.casesTargeted,
    );
  });
});
