import { ExtractionService } from './extraction.service';
import type { SeedCandidate } from './lib/proposal-draft';

function candidate(overrides: Partial<SeedCandidate> = {}): SeedCandidate {
  return {
    id: 'change-1',
    projectId: 'project-1',
    filePath: 'src/cart.spec.ts',
    detectedPattern: '*.spec.ts',
    evidenceId: 'evidence-1',
    ...overrides,
  };
}

interface FakePrisma {
  extractedProposal: { createMany: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    extractedProposal: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

function build(prisma: FakePrisma) {
  return new ExtractionService(prisma as never);
}

describe('ExtractionService.seed', () => {
  it('stores one pending proposal per detected test file', async () => {
    const prisma = createPrisma();

    const created = await build(prisma).seed([candidate()]);

    expect(created).toBe(1);
    const [call] = prisma.extractedProposal.createMany.mock.calls as [
      [{ data: Record<string, unknown>[]; skipDuplicates: boolean }],
    ];
    expect(call[0].data).toEqual([
      expect.objectContaining({
        codeChangeId: 'change-1',
        evidenceId: 'evidence-1',
        projectId: 'project-1',
        status: 'in_review',
        title: 'src/cart.spec.ts',
      }),
    ]);
  });

  it('reprocessing the same code change never duplicates a proposal', async () => {
    const prisma = createPrisma();

    await build(prisma).seed([candidate()]);

    const [call] = prisma.extractedProposal.createMany.mock.calls as [
      [{ skipDuplicates: boolean }],
    ];
    expect(call[0].skipDuplicates).toBe(true);
  });

  it('never touches the database when no file matched a pattern', async () => {
    const prisma = createPrisma();

    const created = await build(prisma).seed([
      candidate({ detectedPattern: null }),
    ]);

    expect(created).toBe(0);
    expect(prisma.extractedProposal.createMany).not.toHaveBeenCalled();
  });

  it('never touches the database when there are no candidates', async () => {
    const prisma = createPrisma();

    await build(prisma).seed([]);

    expect(prisma.extractedProposal.createMany).not.toHaveBeenCalled();
  });
});
