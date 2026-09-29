import { Prisma } from '../../generated/prisma/client';

interface UniqueConstraintViolationCause {
  originalCode: '23505';
  originalMessage: string;
  kind: 'UniqueConstraintViolation';
  constraint: { fields: string[] } | undefined;
}

class DriverAdapterError extends Error {
  override readonly name = 'DriverAdapterError';
  override readonly cause: UniqueConstraintViolationCause;

  constructor(payload: UniqueConstraintViolationCause) {
    super(payload.kind);
    this.cause = payload;
  }
}

export const TEST_CASE_NAME_INDEX = 'test_case_suiteId_name_key';
export const TEST_CASE_AUTOMATION_KEY_INDEX =
  'test_case_suiteId_automationKey_key';
const TEST_CASE_VERSION_INDEX = 'test_case_version_testCaseId_version_key';

function describeFields(fields: readonly string[] | undefined): string {
  return fields === undefined
    ? '(not available)'
    : `fields: (${fields.map((field) => `\`${field}\``).join(', ')})`;
}

export function postgresUniqueViolation(options: {
  index: string;
  detailColumns?: readonly string[];
}): Prisma.PrismaClientKnownRequestError {
  const driverAdapterError = new DriverAdapterError({
    originalCode: '23505',
    originalMessage: `duplicate key value violates unique constraint "${options.index}"`,
    kind: 'UniqueConstraintViolation',
    constraint:
      options.detailColumns === undefined
        ? undefined
        : { fields: [...options.detailColumns] },
  });

  return new Prisma.PrismaClientKnownRequestError(
    `Unique constraint failed on the ${describeFields(options.detailColumns)}`,
    { code: 'P2002', clientVersion: '7.8.0', meta: { driverAdapterError } },
  );
}

export function uniqueViolationWithMeta(
  meta: Record<string, unknown> | undefined,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.8.0',
    meta,
  });
}

export function testCaseNameViolation(): Prisma.PrismaClientKnownRequestError {
  return postgresUniqueViolation({
    index: TEST_CASE_NAME_INDEX,
    detailColumns: ['"suiteId"', 'name'],
  });
}

export function testCaseAutomationKeyViolation(): Prisma.PrismaClientKnownRequestError {
  return postgresUniqueViolation({
    index: TEST_CASE_AUTOMATION_KEY_INDEX,
    detailColumns: ['"suiteId"', '"automationKey"'],
  });
}

export function testCaseVersionViolation(): Prisma.PrismaClientKnownRequestError {
  return postgresUniqueViolation({
    index: TEST_CASE_VERSION_INDEX,
    detailColumns: ['"testCaseId"', 'version'],
  });
}
