import type { Job } from 'bullmq';
import { ReclassifySuiteProcessor } from './reclassify-suite.processor';
import type { ReclassifySuiteJobData } from './proposal-classification.contracts';

interface FakeProposal {
  id: string;
  suiteId: string | null;
  status: string;
  automationKey: string | null;
  title: string;
  steps: string[];
  expectedResult: string;
  targetTestCaseId: string | null;
}

interface FakeCase {
  id: string;
  suiteId: string;
  automationKey: string | null;
  name: string;
  steps: string[];
  expectedResult: string;
}

function job(suiteId: string): Job<ReclassifySuiteJobData> {
  return {
    name: 'reclassify-suite',
    data: { suiteId },
  } as unknown as Job<ReclassifySuiteJobData>;
}

function buildPrisma(proposals: FakeProposal[], cases: FakeCase[]) {
  const updates: { id: string; data: Record<string, unknown> }[] = [];
  const testCaseFindManyCalls: unknown[] = [];

  const prisma = {
    extractedProposal: {
      findMany: jest.fn(
        ({ where }: { where: { suiteId: string; status: string } }) =>
          Promise.resolve(
            proposals.filter(
              (proposal) =>
                proposal.suiteId === where.suiteId &&
                proposal.status === where.status,
            ),
          ),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          updates.push({ id: where.id, data });
          return Promise.resolve(null);
        },
      ),
    },
    testCase: {
      findMany: jest.fn(
        (args: {
          where: {
            suiteId?: string | { not: string };
            automationKey?: { in: string[] };
          };
        }) => {
          testCaseFindManyCalls.push(args);
          const { where } = args;

          if (typeof where.suiteId === 'string') {
            return Promise.resolve(
              cases.filter((row) => row.suiteId === where.suiteId),
            );
          }

          const excludedSuiteId = where.suiteId?.not;
          const keys = where.automationKey?.in ?? [];

          return Promise.resolve(
            cases.filter(
              (row) =>
                row.suiteId !== excludedSuiteId &&
                row.automationKey !== null &&
                keys.includes(row.automationKey),
            ),
          );
        },
      ),
    },
  };

  return { prisma, updates, testCaseFindManyCalls };
}

function proposal(overrides: Partial<FakeProposal> = {}): FakeProposal {
  return {
    id: 'proposal-1',
    suiteId: 'suite-1',
    status: 'in_review',
    automationKey: null,
    title: 'Adds an item to the cart',
    steps: ['Open the product page', 'Click add to cart'],
    expectedResult: 'The item appears in the cart',
    targetTestCaseId: null,
    ...overrides,
  };
}

function testCase(overrides: Partial<FakeCase> = {}): FakeCase {
  return {
    id: 'case-1',
    suiteId: 'suite-1',
    automationKey: null,
    name: 'Adds an item to the cart',
    steps: ['Open the product page', 'Click add to cart'],
    expectedResult: 'The item appears in the cart',
    ...overrides,
  };
}

describe('ReclassifySuiteProcessor', () => {
  it('classifies as update and sets targetTestCaseId when it was unset', async () => {
    const { prisma, updates } = buildPrisma(
      [proposal({ automationKey: 'CartTest.addsItem' })],
      [testCase({ id: 'case-key', automationKey: 'CartTest.addsItem' })],
    );
    const processor = new ReclassifySuiteProcessor(prisma as never);

    await processor.process(job('suite-1'));

    expect(updates).toHaveLength(1);
    expect(updates[0].data).toMatchObject({
      duplicateKind: 'update',
      matchedCaseId: 'case-key',
      targetTestCaseId: 'case-key',
    });
  });

  it('never overwrites an already-set targetTestCaseId, even when classified as update', async () => {
    const { prisma, updates } = buildPrisma(
      [
        proposal({
          automationKey: 'CartTest.addsItem',
          targetTestCaseId: 'case-explicit',
        }),
      ],
      [testCase({ id: 'case-key', automationKey: 'CartTest.addsItem' })],
    );
    const processor = new ReclassifySuiteProcessor(prisma as never);

    await processor.process(job('suite-1'));

    expect(updates[0].data.targetTestCaseId).toBeUndefined();
    expect(updates[0].data.matchedCaseId).toBe('case-key');
  });

  it('classifies as possible_duplicate from title/steps/expectedResult similarity', async () => {
    const { prisma, updates } = buildPrisma(
      [proposal({ automationKey: null })],
      [
        testCase({
          id: 'case-similar',
          automationKey: 'CartTest.other',
          name: 'Adds an item to the cart',
        }),
      ],
    );
    const processor = new ReclassifySuiteProcessor(prisma as never);

    await processor.process(job('suite-1'));

    expect(updates[0].data).toMatchObject({
      duplicateKind: 'possible_duplicate',
      matchedCaseId: 'case-similar',
    });
    expect(updates[0].data.targetTestCaseId).toBeUndefined();
  });

  it('classifies as none and clears matchedCaseId when nothing plausibly matches', async () => {
    const { prisma, updates } = buildPrisma(
      [
        proposal({
          title: 'Zebra quokka umbrella',
          steps: ['Xylophone yak zeppelin'],
          expectedResult: 'Wombat narwhal',
        }),
      ],
      [
        testCase({
          id: 'case-unrelated',
          name: 'Checks the shipping estimate',
          steps: ['Open checkout'],
          expectedResult: 'Estimate is displayed',
        }),
      ],
    );
    const processor = new ReclassifySuiteProcessor(prisma as never);

    await processor.process(job('suite-1'));

    expect(updates[0].data).toMatchObject({
      duplicateKind: 'none',
      matchedCaseId: null,
      duplicateScore: null,
    });
  });

  it('adds cross-suite-key reason from a matching case in a different suite, without treating it as an in-suite candidate', async () => {
    const { prisma, updates } = buildPrisma(
      [
        proposal({
          automationKey: 'CartTest.addsItem',
          title: 'Zebra quokka umbrella',
          steps: ['Xylophone yak zeppelin'],
          expectedResult: 'Wombat narwhal',
        }),
      ],
      [
        testCase({
          id: 'case-other-suite',
          suiteId: 'suite-2',
          automationKey: 'CartTest.addsItem',
        }),
      ],
    );
    const processor = new ReclassifySuiteProcessor(prisma as never);

    await processor.process(job('suite-1'));

    expect(updates[0].data).toMatchObject({
      duplicateKind: 'none',
      matchedCaseId: null,
    });
    expect(updates[0].data.duplicateReasons).toEqual(['cross-suite-key']);
  });

  it('does nothing and never queries test cases when the suite has no in_review proposals', async () => {
    const { prisma, updates, testCaseFindManyCalls } = buildPrisma([], []);
    const processor = new ReclassifySuiteProcessor(prisma as never);

    await processor.process(job('suite-1'));

    expect(updates).toHaveLength(0);
    expect(testCaseFindManyCalls).toHaveLength(0);
  });

  it('ignores decided proposals outside in_review when reclassifying the suite', async () => {
    const { prisma, updates } = buildPrisma(
      [proposal({ id: 'decided-1', status: 'approved' })],
      [testCase()],
    );
    const processor = new ReclassifySuiteProcessor(prisma as never);

    await processor.process(job('suite-1'));

    expect(updates).toHaveLength(0);
  });
});
