import type { PrismaService } from '../../../prisma/prisma.service';
import { classNameAsTestFilePath } from './classname-as-file-path';

export type AutomationPathLookup = Pick<
  PrismaService,
  'extractedProposal' | 'testCase'
>;

export async function resolveAutomationFilePath(
  prisma: AutomationPathLookup,
  projectId: string,
  automationKey: string | null,
  automationClassName?: string | null,
): Promise<string | null> {
  if (automationKey === null) return null;

  const fromClassName = classNameAsTestFilePath(automationClassName);
  if (fromClassName !== null) return fromClassName;

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
