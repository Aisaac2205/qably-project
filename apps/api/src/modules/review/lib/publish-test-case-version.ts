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
