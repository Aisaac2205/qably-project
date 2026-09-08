import type { PrismaService } from '../../../prisma/prisma.service';

export type AutomationPathLookup = Pick<
  PrismaService,
  'extractedProposal' | 'testCase'
>;

export async function resolveAutomationFilePath(
  prisma: AutomationPathLookup,
  projectId: string,
  automationKey: string | null,
): Promise<string | null> {
  if (automationKey === null) return null;

  const fromRepository = await prisma.extractedProposal.findFirst({
    where: {
      projectId,
      automationKey,
      codeChange: { isNot: null },
    },
    orderBy: { createdAt: 'desc' },
    select: { codeChange: { select: { filePath: true } } },
  });

  const repositoryPath = fromRepository?.codeChange?.filePath ?? null;
  if (repositoryPath !== null) return repositoryPath;

  const sibling = await prisma.testCase.findFirst({
    where: {
      projectId,
      automationKey,
      automationFilePath: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    select: { automationFilePath: true },
  });

  return sibling?.automationFilePath ?? null;
}
