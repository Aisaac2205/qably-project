import { createHash } from 'node:crypto';
import type { JunitCase, JunitReport } from './parse-junit-xml';

const MAX_SLUG_LENGTH = 60;
const MAX_GROUPS = 500;

export interface JunitSuiteGroup {
  suiteName: string;
  externalId: string;
  cases: JunitCase[];
}

export type JunitGroupingErrorCode = 'group-limit-exceeded';

export class JunitGroupingError extends Error {
  readonly code: JunitGroupingErrorCode;

  constructor(code: JunitGroupingErrorCode, message: string) {
    super(message);
    this.name = 'JunitGroupingError';
    this.code = code;
  }
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');

  return slug.length > 0 ? slug : 'suite';
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

function suiteExternalId(externalId: string, suiteKey: string): string {
  return `${externalId}-${slugify(suiteKey)}-${shortHash(suiteKey)}`;
}

export function groupJunitReportBySuite(
  report: JunitReport,
  externalId: string,
): JunitSuiteGroup[] {
  const order: string[] = [];
  const casesBySuite = new Map<string, JunitCase[]>();

  for (const testCase of report.cases) {
    const bucket = casesBySuite.get(testCase.suiteKey);

    if (bucket === undefined) {
      order.push(testCase.suiteKey);
      casesBySuite.set(testCase.suiteKey, [testCase]);
    } else {
      bucket.push(testCase);
    }
  }

  if (order.length > MAX_GROUPS) {
    throw new JunitGroupingError(
      'group-limit-exceeded',
      `junit report groups into more than ${MAX_GROUPS} distinct suites`,
    );
  }

  const single = order.length <= 1;

  return order.map((suiteKey) => {
    const cases = casesBySuite.get(suiteKey) as JunitCase[];

    return {
      suiteName: cases[0].suiteName,
      externalId: single ? externalId : suiteExternalId(externalId, suiteKey),
      cases,
    };
  });
}
