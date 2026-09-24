import { ExtractionFailureRecorder } from './extraction-failure-recorder';
import type { DocumentFileJobContext, JobContext } from './extraction.types';

interface FakePrisma {
  testCase: { updateMany: jest.Mock };
  extractedProposal: { findFirst: jest.Mock; create: jest.Mock };
  evidence: { create: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    testCase: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    extractedProposal: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'proposal-new' }),
    },
    evidence: {
      create: jest.fn().mockResolvedValue({ id: 'evidence-new' }),
    },
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
    fallbackEvidenceId: null,
    locale: undefined,
    isFinalAttempt: true,
    isFirstAttempt: true,
    ...overrides,
  };
}

describe('ExtractionFailureRecorder', () => {
  describe('recordForJob', () => {
    it('writes the failed documentation state and creates no proposal when the source was unavailable', async () => {
      const prisma = createPrisma();
      const recorder = new ExtractionFailureRecorder(prisma as never);

      await recorder.recordForJob(jobContext(), 'no-connection');

      const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
        {
          where: Record<string, unknown>;
          data: {
            documentationOutcome: string;
            documentationSkipReason: string;
          };
        },
      ];
      expect(where).toEqual({
        id: 'case-1',
        documentationSource: { not: 'human' },
        documentationQueuedAt: { not: null },
      });
      expect(data.documentationOutcome).toBe('failed');
      expect(data.documentationSkipReason).toBe('no-connection');
      expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    });

    it('does not write a failed documentation state for an untargeted source-unavailable failure', async () => {
      const prisma = createPrisma();
      const recorder = new ExtractionFailureRecorder(prisma as never);

      await recorder.recordForJob(
        jobContext({ targetTestCaseId: null }),
        'timeout',
      );

      expect(prisma.testCase.updateMany).not.toHaveBeenCalled();
      expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    });

    it('does not create a second fallback proposal when one is already pending', async () => {
      const prisma = createPrisma();
      prisma.extractedProposal.findFirst.mockResolvedValue({
        id: 'proposal-existing',
      });
      const recorder = new ExtractionFailureRecorder(prisma as never);

      await recorder.recordForJob(jobContext(), 'extraction-failed');

      expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    });

    it('reuses the context fallbackEvidenceId instead of creating new evidence', async () => {
      const prisma = createPrisma();
      const recorder = new ExtractionFailureRecorder(prisma as never);

      await recorder.recordForJob(
        jobContext({ fallbackEvidenceId: 'evidence-existing' }),
        'extraction-failed',
      );

      expect(prisma.evidence.create).not.toHaveBeenCalled();
      const [{ data }] = prisma.extractedProposal.create.mock.calls[0] as [
        { data: { evidenceId: string } },
      ];
      expect(data.evidenceId).toBe('evidence-existing');
    });

    it('creates fallback evidence when the context has none yet', async () => {
      const prisma = createPrisma();
      const recorder = new ExtractionFailureRecorder(prisma as never);

      await recorder.recordForJob(jobContext(), 'extraction-failed');

      expect(prisma.evidence.create).toHaveBeenCalledTimes(1);
      const [{ data }] = prisma.extractedProposal.create.mock.calls[0] as [
        { data: { evidenceId: string } },
      ];
      expect(data.evidenceId).toBe('evidence-new');
    });
  });

  describe('recordForTargets', () => {
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

    it('excludes human-documented cases from the failed-state updateMany guard', async () => {
      const prisma = createPrisma();
      const recorder = new ExtractionFailureRecorder(prisma as never);

      await recorder.recordForTargets(
        documentFileContext(),
        [{ testCaseId: 'case-1', automationKey: 'Cart > adds an item' }],
        'extraction-failed',
      );

      const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
        {
          where: Record<string, unknown>;
          data: { documentationOutcome: string };
        },
      ];
      expect(where).toEqual({
        id: { in: ['case-1'] },
        documentationSource: { not: 'human' },
        documentationQueuedAt: { not: null },
      });
      expect(data.documentationOutcome).toBe('failed');
    });

    it('records a fallback for every target', async () => {
      const prisma = createPrisma();
      const recorder = new ExtractionFailureRecorder(prisma as never);

      await recorder.recordForTargets(
        documentFileContext(),
        [
          { testCaseId: 'case-1', automationKey: 'Cart > adds an item' },
          { testCaseId: 'case-2', automationKey: 'Cart > empties the cart' },
        ],
        'extraction-failed',
      );

      expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(2);
    });

    it('does nothing when there are no targets', async () => {
      const prisma = createPrisma();
      const recorder = new ExtractionFailureRecorder(prisma as never);

      await recorder.recordForTargets(
        documentFileContext(),
        [],
        'extraction-failed',
      );

      expect(prisma.testCase.updateMany).not.toHaveBeenCalled();
      expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    });
  });
});
