import { XMLParser, XMLValidator } from 'fast-xml-parser';

const MAX_NAME_LENGTH = 120;

export type JunitCaseStatus = 'pass' | 'fail' | 'skip';

export interface JunitCase {
  name: string;
  suiteName: string;
  status: JunitCaseStatus;
}

export interface JunitReport {
  suiteName: string;
  cases: JunitCase[];
}

interface RawNode {
  [key: string]: unknown;
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
  processEntities: {
    enabled: true,
    maxEntitySize: 1_000,
    maxEntityCount: 50,
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

function truncate(value: string): string {
  return value.slice(0, MAX_NAME_LENGTH);
}

function caseStatus(node: RawNode): JunitCaseStatus {
  if ('failure' in node || 'error' in node) return 'fail';
  if ('skipped' in node) return 'skip';
  return 'pass';
}

function collectSuites(root: RawNode): RawNode[] {
  const nested = toArray(root.testsuite);
  if (nested.length > 0) return nested;
  return [root];
}

export function parseJunitXml(xml: string): JunitReport {
  const validation = XMLValidator.validate(xml);

  if (validation !== true) {
    throw new Error(`invalid junit xml: ${validation.err.msg}`);
  }

  const document = parser.parse(xml) as RawNode;
  const suitesRoot = document.testsuites as RawNode | undefined;
  const suiteRoot = document.testsuite as RawNode | undefined;
  const root = suitesRoot ?? suiteRoot;

  if (root === undefined) {
    throw new Error('junit xml has no testsuite or testsuites root');
  }

  const suites = suitesRoot === undefined ? [root] : collectSuites(root);
  const cases: JunitCase[] = [];

  for (const suite of suites) {
    const suiteName = truncate(readAttribute(suite, 'name'));

    for (const testCase of toArray(suite.testcase)) {
      const name =
        readAttribute(testCase, 'name') || readAttribute(testCase, 'classname');

      if (name === '') continue;

      cases.push({
        name: truncate(name),
        suiteName,
        status: caseStatus(testCase),
      });
    }
  }

  if (cases.length === 0) {
    throw new Error('junit xml contains no testcase entries');
  }

  return {
    suiteName: truncate(readAttribute(root, 'name')) || cases[0].suiteName,
    cases,
  };
}
