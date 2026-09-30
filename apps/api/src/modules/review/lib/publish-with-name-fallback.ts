import type { Logger } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { NameHolder } from '../document-file-diagnostics';
import {
  publishTestCaseVersion,
  type PublishedTestCaseVersion,
  type PublishTestCaseVersionCaseOverrides,
  type PublishTestCaseVersionFields,
  type PublishTestCaseVersionTx,
} from './publish-test-case-version';
import { testCaseUniqueConstraint } from './test-case-unique-constraint';

const CASE_PUBLISH_SAVEPOINT = 'case_publish';
const NONE = 'none';

type TitleHolder = Pick<NameHolder, 'id' | 'automationKey'>;

export interface NameFallbackTx extends PublishTestCaseVersionTx {
  testCase: PublishTestCaseVersionTx['testCase'] & {
    findFirst: PrismaService['testCase']['findFirst'];
  };
  $executeRawUnsafe: PrismaService['$executeRawUnsafe'];
}

export interface PublishWithNameFallbackInput {
  testCaseId: string;
  suiteId: string;
  automationKey: string;
  currentName: string;
  fields: PublishTestCaseVersionFields;
  overrides: PublishTestCaseVersionCaseOverrides;
}

function describeHolder(holder: TitleHolder | null): string {
  if (holder === null) return 'a case that could not be identified';

  const key =
    holder.automationKey === null ? NONE : JSON.stringify(holder.automationKey);

  return `case ${holder.id} (key ${key})`;
}

function describeKeptName(
  input: PublishWithNameFallbackInput,
  holder: TitleHolder | null,
): string {
  return `Kept the current name ${JSON.stringify(input.currentName)} of case ${input.testCaseId} (key ${JSON.stringify(input.automationKey)}): the proposed title ${JSON.stringify(input.fields.title)} is already held by ${describeHolder(holder)}`;
}

async function publishInsideSavepoint(
  tx: NameFallbackTx,
  input: PublishWithNameFallbackInput,
): Promise<PublishedTestCaseVersion | null> {
  await tx.$executeRawUnsafe(`SAVEPOINT ${CASE_PUBLISH_SAVEPOINT}`);

  try {
    const version = await publishTestCaseVersion(
      tx,
      input.testCaseId,
      input.fields,
      input.overrides,
    );

    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${CASE_PUBLISH_SAVEPOINT}`);
    return version;
  } catch (error) {
    if (testCaseUniqueConstraint(error) !== 'name') throw error;

    await tx.$executeRawUnsafe(
      `ROLLBACK TO SAVEPOINT ${CASE_PUBLISH_SAVEPOINT}`,
    );
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${CASE_PUBLISH_SAVEPOINT}`);
    return null;
  }
}

export async function publishWithNameFallback(
  tx: NameFallbackTx,
  input: PublishWithNameFallbackInput,
  logger: Pick<Logger, 'warn'>,
): Promise<PublishedTestCaseVersion> {
  const published = await publishInsideSavepoint(tx, input);
  if (published !== null) return published;

  const holder = await tx.testCase.findFirst({
    where: { suiteId: input.suiteId, name: input.fields.title },
    select: { id: true, automationKey: true },
  });

  logger.warn(describeKeptName(input, holder));

  return publishTestCaseVersion(tx, input.testCaseId, input.fields, {
    ...input.overrides,
    name: input.currentName,
  });
}
