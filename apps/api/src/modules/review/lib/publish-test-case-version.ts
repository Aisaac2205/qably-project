import type { PrismaService } from '../../../prisma/prisma.service';

export interface PublishTestCaseVersionFields {
  title: string;
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  locale: string | null;
}

export type PublishTestCaseVersionCaseOverrides = Record<string, unknown>;

export interface PublishTestCaseVersionTx {
  testCaseVersion: {
    count: PrismaService['testCaseVersion']['count'];
    create: PrismaService['testCaseVersion']['create'];
  };
  testCase: {
    update: PrismaService['testCase']['update'];
  };
}

export interface PublishedTestCaseVersion {
  id: string;
  version: number;
}

export interface CurrentTestCaseVersionFields {
  title: string;
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  priority: string;
  locale: string | null;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Whether `current` (the case's already-published version) carries exactly
 * the documentation `next` is about to write. Used to make a redelivered
 * document-file job a no-op instead of creating a new version every retry.
 */
export function isSameDocumentation(
  current: CurrentTestCaseVersionFields | null,
  next: PublishTestCaseVersionFields,
): boolean {
  if (current === null) return false;

  return (
    current.title === next.title &&
    current.objective === next.objective &&
    arraysEqual(current.preconditions, next.preconditions) &&
    arraysEqual(current.steps, next.steps) &&
    current.expectedResult === next.expectedResult &&
    current.priority === next.priority &&
    (current.locale ?? null) === (next.locale ?? null)
  );
}

export async function publishTestCaseVersion(
  tx: PublishTestCaseVersionTx,
  testCaseId: string,
  fields: PublishTestCaseVersionFields,
  caseOverrides: PublishTestCaseVersionCaseOverrides = {},
): Promise<PublishedTestCaseVersion> {
  const published = await tx.testCaseVersion.count({
    where: { testCaseId },
  });

  const version = await tx.testCaseVersion.create({
    data: {
      testCaseId,
      version: published + 1,
      title: fields.title,
      objective: fields.objective,
      preconditions: fields.preconditions,
      steps: fields.steps,
      expectedResult: fields.expectedResult,
      priority: fields.priority,
      locale: fields.locale,
    },
    select: { id: true, version: true },
  });

  await tx.testCase.update({
    where: { id: testCaseId },
    data: {
      currentVersionId: version.id,
      name: fields.title,
      steps: fields.steps,
      expectedResult: fields.expectedResult,
      ...caseOverrides,
    },
  });

  return version;
}
