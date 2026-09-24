import { ExtractionFailureRecorder } from './extraction-failure-recorder';
import type { DocumentFileJobContext, JobContext } from './extraction.types';

const REAL_FAILURE_REASONS = [
  'ai-not-enabled',
  'extraction-failed',
  'no-tests-found',
  'extraction-incomplete',
  'automation-key-not-found',
  'not-configured',
  'invalid-credentials',
  'rate-limited',
  'provider-overloaded',
  'empty-response',
  'invalid-json-response',
  'schema-violation',
  'unknown-provider-error',
  'quota-exhausted',
  'no-connection',
  'timeout',
  'fetch-failed',
  'http-404',
];

interface FakePrisma {
  testCase: { updateMany: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    testCase: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

function jobContext(overrides: Partial<JobContext> = {}): JobContext {
  return {
    projectId: 'project-1',
    organizationId: 'org-1',
    filePath: 'src/cart.spec.ts',
    ref: 'HEAD',
    connection: null,
    codeChangeId: null,
    targetTestCaseId: 'case-1',
    knownSuiteId: null,
    onlyAutomationKey: null,
    locale: undefined,
    isFinalAttempt: true,
    isFirstAttempt: true,
    ...overrides,
  };
}

function documentFileContext(
  overrides: Partial<DocumentFileJobContext> = {},
): DocumentFileJobContext {
  return {
    projectId: 'project-1',
    organizationId: 'org-1',
    filePath: 'src/cart.spec.ts',
    ref: 'HEAD',
    connection: null,
    targets: [],
    locale: undefined,
    requestSuiteSummary: false,
    isFinalAttempt: true,
    isFirstAttempt: true,
    ...overrides,
  };
}

describe('ExtractionFailureRecorder', () => {
  describe('recordExtractionFailure', () => {
    it.each(REAL_FAILURE_REASONS)(
      'marks the targeted case failed for reason "%s" and creates no proposal',
      async (reason) => {
        const prisma = createPrisma();
        const recorder = new ExtractionFailureRecorder(prisma as never);

        await recorder.recordExtractionFailure(jobContext(), reason);

        const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
          {
            where: Record<string, unknown>;
            data: {
              documentationOutcome: string;
              documentationSkipReason: string;
            };
          },
        ];
        expect(where.id).toEqual({ in: ['case-1'] });
        expect(data.documentationOutcome).toBe('failed');
        expect(data.documentationSkipReason).toBe(reason);
      },
    );

    it('excludes human-documented cases from the failed-state guard', async () => {
      const prisma = createPrisma();
      const recorder = new ExtractionFailureRecorder(prisma as never);

      await recorder.recordExtractionFailure(jobContext(), 'extraction-failed');

      const [{ where }] = prisma.testCase.updateMany.mock.calls[0] as [
        { where: { documentationSource: { not: string } } },
      ];
      expect(where.documentationSource).toEqual({ not: 'human' });
    });

    it('also marks a case failed when it was never queued but has no outcome yet', async () => {
      const prisma = createPrisma();
      const recorder = new ExtractionFailureRecorder(prisma as never);

      await recorder.recordExtractionFailure(jobContext(), 'extraction-failed');

      const [{ where }] = prisma.testCase.updateMany.mock.calls[0] as [
        { where: { OR: unknown[] } },
      ];
      expect(where.OR).toEqual([
        { documentationQueuedAt: { not: null } },
        { documentationOutcome: null },
        { documentationOutcome: 'failed' },
      ]);
    });

    it('only logs a warning and writes nothing when there is no target case', async () => {
      const prisma = createPrisma();
      const recorder = new ExtractionFailureRecorder(prisma as never);

      await recorder.recordExtractionFailure(
        jobContext({ targetTestCaseId: null }),
        'extraction-failed',
      );

      expect(prisma.testCase.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('recordExtractionFailureForTargets', () => {
    it.each(REAL_FAILURE_REASONS)(
      'marks every targeted case failed for reason "%s"',
      async (reason) => {
        const prisma = createPrisma();
        const recorder = new ExtractionFailureRecorder(prisma as never);

        await recorder.recordExtractionFailureForTargets(
          documentFileContext(),
          [
            { testCaseId: 'case-1', automationKey: 'Cart > adds an item' },
            { testCaseId: 'case-2', automationKey: 'Cart > empties the cart' },
          ],
          reason,
        );

        const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
          {
            where: { id: { in: string[] } };
            data: { documentationSkipReason: string };
          },
        ];
        expect(where.id).toEqual({ in: ['case-1', 'case-2'] });
        expect(data.documentationSkipReason).toBe(reason);
      },
    );

    it('does nothing when there are no targets', async () => {
      const prisma = createPrisma();
      const recorder = new ExtractionFailureRecorder(prisma as never);

      await recorder.recordExtractionFailureForTargets(
        documentFileContext(),
        [],
        'extraction-failed',
      );

      expect(prisma.testCase.updateMany).not.toHaveBeenCalled();
    });
  });
});
