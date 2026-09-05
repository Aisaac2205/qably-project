import { XMLParser, XMLValidator } from 'fast-xml-parser';

const MAX_NAME_LENGTH = 120;
const MAX_CLASS_NAME_LENGTH = 250;
const MAX_FILE_PATH_LENGTH = 500;
const MAX_FAILURE_MESSAGE_LENGTH = 1000;
const MAX_FAILURE_DETAILS_LENGTH = 4000;
const MAX_SKIP_REASON_LENGTH = 500;
const MAX_TESTSUITE_DEPTH = 32;
const MAX_TESTCASES = 10_000;

export type JunitCaseStatus = 'pass' | 'fail' | 'skip';

export interface JunitCase {
  name: string;
  suiteName: string;
  status: JunitCaseStatus;
  className?: string;
  filePath?: string;
  durationMs?: number;
  failureType?: string;
  failureMessage?: string;
  failureDetails?: string;
  skipReason?: string;
}

export interface JunitReport {
  suiteName: string;
  cases: JunitCase[];
}

export type JunitParseErrorCode =
  | 'invalid-xml'
  | 'missing-root'
  | 'no-testcases'
  | 'depth-exceeded'
  | 'testcase-limit-exceeded';

export class JunitParseError extends Error {
  readonly code: JunitParseErrorCode;

  constructor(code: JunitParseErrorCode, message: string) {
    super(message);
    this.name = 'JunitParseError';
    this.code = code;
  }
}

interface RawNode {
  [key: string]: unknown;
}

type CaseOutcome =
  | { status: 'pass' }
  | {
      status: 'fail';
      failureType?: string;
      failureMessage?: string;
      failureDetails?: string;
    }
  | { status: 'skip'; skipReason?: string };

interface CollectedCase {
  suiteName: string;
  raw: RawNode;
}

/**
 * The payload arrives from anyone holding a project API key, so entity
 * handling matters. fast-xml-parser 5 decodes the predefined entities into the
 * test names but never substitutes entities declared in a DOCTYPE, which keeps
 * an expansion bomb inert; the limits below bound what it does expand.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: {
    enabled: true,
    maxEntitySize: 1_000,
    maxEntityCount: 50,
    maxExpansionDepth: 20,
    maxTotalExpansions: 100,
    maxExpandedLength: 100_000,
  },
});

function toArray(value: unknown): RawNode[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value as RawNode[];
  if (typeof value === 'object') return [value as RawNode];
  return [];
}

function readAttribute(node: RawNode, attribute: string): string {
  const value = node[`@_${attribute}`];
  return typeof value === 'string' ? value : '';
}

function truncateTo(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

function truncate(value: string): string {
  return truncateTo(value, MAX_NAME_LENGTH);
}

function firstChild(node: RawNode, tag: string): RawNode | string | undefined {
  const value = node[tag];

  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value[0] as RawNode | string | undefined;
  return value as RawNode | string;
}

function childText(value: RawNode | string | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value.trim();

  const text = value['#text'];
  return typeof text === 'string' ? text.trim() : '';
}

function childAttribute(
  value: RawNode | string | undefined,
  attribute: string,
): string {
  if (value === undefined || typeof value === 'string') return '';
  return readAttribute(value, attribute);
}

function parseDurationMs(rawTime: string): number | undefined {
  if (rawTime === '') return undefined;

  const seconds = Number.parseFloat(rawTime);
  if (!Number.isFinite(seconds)) return undefined;

  return Math.round(Math.max(seconds, 0) * 1000);
}

function deriveCaseOutcome(node: RawNode): CaseOutcome {
  const failureValue = firstChild(node, 'failure');
  const errorValue = firstChild(node, 'error');
  const skippedValue = firstChild(node, 'skipped');
  const failureOrError = failureValue ?? errorValue;

  if (failureOrError !== undefined) {
    const failureType = childAttribute(failureOrError, 'type');
    const failureMessage = childAttribute(failureOrError, 'message');
    const failureDetails = childText(failureOrError);

    return {
      status: 'fail',
      ...(failureType === ''
        ? {}
        : { failureType: truncateTo(failureType, MAX_CLASS_NAME_LENGTH) }),
      ...(failureMessage === ''
        ? {}
        : {
            failureMessage: truncateTo(
              failureMessage,
              MAX_FAILURE_MESSAGE_LENGTH,
            ),
          }),
      ...(failureDetails === ''
        ? {}
        : {
            failureDetails: truncateTo(
              failureDetails,
              MAX_FAILURE_DETAILS_LENGTH,
            ),
          }),
    };
  }

  if (skippedValue !== undefined) {
    const skipReason =
      childAttribute(skippedValue, 'message') || childText(skippedValue);

    return {
      status: 'skip',
      ...(skipReason === ''
        ? {}
        : { skipReason: truncateTo(skipReason, MAX_SKIP_REASON_LENGTH) }),
    };
  }

  return { status: 'pass' };
}

function outcomeFields(outcome: CaseOutcome): Partial<JunitCase> {
  switch (outcome.status) {
    case 'pass':
      return {};
    case 'fail':
      return {
        ...(outcome.failureType === undefined
          ? {}
          : { failureType: outcome.failureType }),
        ...(outcome.failureMessage === undefined
          ? {}
          : { failureMessage: outcome.failureMessage }),
        ...(outcome.failureDetails === undefined
          ? {}
          : { failureDetails: outcome.failureDetails }),
      };
    case 'skip':
      return outcome.skipReason === undefined
        ? {}
        : { skipReason: outcome.skipReason };
  }
}

function collectCases(
  node: RawNode,
  parentSuiteName: string,
  depth: number,
  acc: CollectedCase[],
): void {
  if (depth > MAX_TESTSUITE_DEPTH) {
    throw new JunitParseError(
      'depth-exceeded',
      `junit xml nests more than ${MAX_TESTSUITE_DEPTH} testsuite levels`,
    );
  }

  const ownName = readAttribute(node, 'name');
  const suiteName = ownName === '' ? parentSuiteName : truncate(ownName);

  for (const testCase of toArray(node.testcase)) {
    if (acc.length >= MAX_TESTCASES) {
      throw new JunitParseError(
        'testcase-limit-exceeded',
        `junit xml exceeds the ${MAX_TESTCASES} testcase limit`,
      );
    }

    acc.push({ suiteName, raw: testCase });
  }

  for (const child of toArray(node.testsuite)) {
    collectCases(child, suiteName, depth + 1, acc);
  }
}

export function parseJunitXml(xml: string): JunitReport {
  const validation = XMLValidator.validate(xml);

  if (validation !== true) {
    throw new JunitParseError(
      'invalid-xml',
      `invalid junit xml: ${validation.err.msg}`,
    );
  }

  const document = parser.parse(xml) as RawNode;
  const suitesRoot = document.testsuites as RawNode | undefined;
  const suiteRoot = document.testsuite as RawNode | undefined;
  const root = suitesRoot ?? suiteRoot;

  if (root === undefined) {
    throw new JunitParseError(
      'missing-root',
      'junit xml has no testsuite or testsuites root',
    );
  }

  const collected: CollectedCase[] = [];
  collectCases(root, '', 1, collected);

  const cases: JunitCase[] = [];

  for (const { suiteName, raw } of collected) {
    const name = readAttribute(raw, 'name') || readAttribute(raw, 'classname');
    if (name === '') continue;

    const outcome = deriveCaseOutcome(raw);
    const className = readAttribute(raw, 'classname');
    const filePath = readAttribute(raw, 'file');
    const durationMs = parseDurationMs(readAttribute(raw, 'time'));

    cases.push({
      name: truncate(name),
      suiteName,
      status: outcome.status,
      ...(className === ''
        ? {}
        : { className: truncateTo(className, MAX_CLASS_NAME_LENGTH) }),
      ...(filePath === ''
        ? {}
        : { filePath: truncateTo(filePath, MAX_FILE_PATH_LENGTH) }),
      ...(durationMs === undefined ? {} : { durationMs }),
      ...outcomeFields(outcome),
    });
  }

  if (cases.length === 0) {
    throw new JunitParseError(
      'no-testcases',
      'junit xml contains no testcase entries',
    );
  }

  return {
    suiteName: truncate(readAttribute(root, 'name')) || cases[0].suiteName,
    cases,
  };
}
