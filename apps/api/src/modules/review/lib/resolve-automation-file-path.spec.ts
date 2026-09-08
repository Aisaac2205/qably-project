import { resolveAutomationFilePath } from './resolve-automation-file-path';

function createPrisma() {
  return {
    extractedProposal: { findFirst: jest.fn().mockResolvedValue(null) },
    testCase: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

describe('resolveAutomationFilePath', () => {
  it('returns null when the case carries no automation key', async () => {
    const prisma = createPrisma();

    const path = await resolveAutomationFilePath(
      prisma as never,
      'proj-1',
      null,
    );

    expect(path).toBeNull();
    expect(prisma.extractedProposal.findFirst).not.toHaveBeenCalled();
    expect(prisma.testCase.findFirst).not.toHaveBeenCalled();
  });

  it('resolves the path from the repository change that produced the same key', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({
      codeChange: { filePath: 'src/cart/cart.spec.ts' },
    });

    const path = await resolveAutomationFilePath(
      prisma as never,
      'proj-1',
      'CartTest.addsItem',
    );

    expect(path).toBe('src/cart/cart.spec.ts');
    expect(prisma.extractedProposal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: 'proj-1',
          automationKey: 'CartTest.addsItem',
          codeChange: { isNot: null },
        },
      }),
    );
    expect(prisma.testCase.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to a sibling case that already knows the path', async () => {
    const prisma = createPrisma();
    prisma.testCase.findFirst.mockResolvedValue({
      automationFilePath: 'src/cart/cart.spec.ts',
    });

    const path = await resolveAutomationFilePath(
      prisma as never,
      'proj-1',
      'CartTest.addsItem',
    );

    expect(path).toBe('src/cart/cart.spec.ts');
    expect(prisma.testCase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: 'proj-1',
          automationKey: 'CartTest.addsItem',
          automationFilePath: { not: null },
        },
      }),
    );
  });

  it('returns null when the repository never produced that key', async () => {
    const prisma = createPrisma();

    const path = await resolveAutomationFilePath(
      prisma as never,
      'proj-1',
      'CartTest.addsItem',
    );

    expect(path).toBeNull();
  });

  it('ignores a proposal whose code change was detached', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({ codeChange: null });
    prisma.testCase.findFirst.mockResolvedValue({
      automationFilePath: 'src/cart/cart.spec.ts',
    });

    const path = await resolveAutomationFilePath(
      prisma as never,
      'proj-1',
      'CartTest.addsItem',
    );

    expect(path).toBe('src/cart/cart.spec.ts');
  });
});
