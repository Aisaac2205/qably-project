import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  callPure,
  runCli,
  runNodeEval,
  REPORTER_MODULE_URL,
} from './test-support';
import { parseJunitXml } from '../modules/runs/lib/parse-junit-xml';
import { groupJunitReportBySuite } from '../modules/runs/lib/group-junit-report';

const smallReport = `<testsuite name="Checkout">
  <testcase name="accepts a valid card"/>
  <testcase name="rejects an expired card"><failure message="boom"/></testcase>
</testsuite>`;

describe('countTestcases', () => {
  it('counts self-closing and paired testcase tags', () => {
    const [count] = callPure<[number]>([
      { fn: 'countTestcases', args: [smallReport] },
    ]);
    expect(count).toBe(2);
  });

  it('returns 0 when there are no testcase tags', () => {
    const [count] = callPure<[number]>([
      { fn: 'countTestcases', args: ['<testsuites></testsuites>'] },
    ]);
    expect(count).toBe(0);
  });
});

describe('findTopLevelTestsuiteBlocks', () => {
  it('returns null for a bare <testsuite> root', () => {
    const [result] = callPure<[unknown]>([
      { fn: 'findTopLevelTestsuiteBlocks', args: [smallReport] },
    ]);
    expect(result).toBeNull();
  });

  it('splits top-level testsuite children, including self-closing ones, and ignores nested ones', () => {
    const xml =
      '<testsuites>' +
      '<testsuite name="a"><testcase name="a1"/><testsuite name="nested"><testcase name="n1"/></testsuite></testsuite>' +
      '<testsuite name="b"/>' +
      '</testsuites>';

    const [result] = callPure<
      [{ blocks: string[]; prefix: string; suffix: string }]
    >([{ fn: 'findTopLevelTestsuiteBlocks', args: [xml] }]);

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0]).toContain('name="a"');
    expect(result.blocks[0]).toContain('nested');
    expect(result.blocks[1]).toBe('<testsuite name="b"/>');
  });

  it('does not let a fake </testsuite> inside a CDATA section corrupt the block boundaries', () => {
    const xml =
      '<testsuites>' +
      '<testsuite name="a"><testcase name="a1"><system-out><![CDATA[fake </testsuite> marker]]></system-out></testcase></testsuite>' +
      '<testsuite name="b"><testcase name="b1"/></testsuite>' +
      '</testsuites>';

    const [result] = callPure<[{ blocks: string[] }]>([
      { fn: 'findTopLevelTestsuiteBlocks', args: [xml] },
    ]);

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0]).toContain('fake </testsuite> marker');
    expect(result.blocks[0]).toContain('name="a1"');
    expect(result.blocks[0].endsWith('</testsuite>')).toBe(true);
    expect(result.blocks[1]).toBe(
      '<testsuite name="b"><testcase name="b1"/></testsuite>',
    );
  });

  it('does not let a fake <testsuite> tag inside an XML comment corrupt the block boundaries', () => {
    const xml =
      '<testsuites>' +
      '<testsuite name="a"><testcase name="a1"/></testsuite>' +
      '<!-- <testsuite name="fake"><testcase name="x"/></testsuite> -->' +
      '<testsuite name="b"><testcase name="b1"/></testsuite>' +
      '</testsuites>';

    const [result] = callPure<[{ blocks: string[] }]>([
      { fn: 'findTopLevelTestsuiteBlocks', args: [xml] },
    ]);

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0]).toBe(
      '<testsuite name="a"><testcase name="a1"/></testsuite>',
    );
    expect(result.blocks[1]).toBe(
      '<testsuite name="b"><testcase name="b1"/></testsuite>',
    );
  });
});

describe('buildSplitRequests', () => {
  it('returns a single unsplit chunk when under both caps', () => {
    const [requests] = callPure<[Array<{ singleGroup: boolean }>]>([
      {
        fn: 'buildSplitRequests',
        args: [smallReport, { maxTestcases: 10_000, maxGroups: 500 }],
      },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0].singleGroup).toBe(true);
  });

  it('reports singleGroup false for a multi-suite report under caps', () => {
    const xml =
      '<testsuites><testsuite name="a"><testcase name="a1"/></testsuite>' +
      '<testsuite name="b"><testcase name="b1"/></testsuite></testsuites>';

    const [requests] = callPure<[Array<{ singleGroup: boolean }>]>([
      {
        fn: 'buildSplitRequests',
        args: [xml, { maxTestcases: 10_000, maxGroups: 500 }],
      },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0].singleGroup).toBe(false);
  });

  it('packs testsuites into chunks that respect the group cap, preserving suite boundaries', () => {
    const suites = ['a', 'b', 'c', 'd', 'e']
      .map(
        (name) =>
          `<testsuite name="${name}"><testcase name="${name}1"/></testsuite>`,
      )
      .join('');
    const xml = `<testsuites>${suites}</testsuites>`;

    const [requests] = callPure<[Array<{ xml: string; singleGroup: boolean }>]>(
      [
        {
          fn: 'buildSplitRequests',
          args: [xml, { maxTestcases: 10_000, maxGroups: 2 }],
        },
      ],
    );

    expect(requests).toHaveLength(3);
    expect(requests[0].xml).toContain('name="a"');
    expect(requests[0].xml).toContain('name="b"');
    expect(requests[0].singleGroup).toBe(false);
    expect(requests[1].xml).toContain('name="c"');
    expect(requests[1].xml).toContain('name="d"');
    expect(requests[2].xml).toContain('name="e"');
    expect(requests[2].singleGroup).toBe(true);
  });

  it('packs testsuites into chunks that respect the testcase cap, never splitting a suite', () => {
    const suites = ['a', 'b', 'c']
      .map(
        (name) =>
          `<testsuite name="${name}">${'<testcase name="c"/>'.repeat(4)}</testsuite>`,
      )
      .join('');
    const xml = `<testsuites>${suites}</testsuites>`;

    const [requests] = callPure<[Array<{ xml: string }>]>([
      {
        fn: 'buildSplitRequests',
        args: [xml, { maxTestcases: 6, maxGroups: 500 }],
      },
    ]);

    expect(requests).toHaveLength(3);
    for (const request of requests) {
      expect(request.xml.match(/<testcase\b/g)).toHaveLength(4);
    }
  });

  it('flags an oversized bare <testsuite> root as unsplittable', () => {
    const xml = `<testsuite name="huge">${'<testcase name="c"/>'.repeat(5)}</testsuite>`;

    const [requests] = callPure<
      [Array<{ oversizedUnsplittable?: boolean; singleGroup: boolean }>]
    >([
      {
        fn: 'buildSplitRequests',
        args: [xml, { maxTestcases: 3, maxGroups: 500 }],
      },
    ]);

    expect(requests).toHaveLength(1);
    expect(requests[0].oversizedUnsplittable).toBe(true);
    expect(requests[0].singleGroup).toBe(true);
  });
});

describe('countTopLevelGroups', () => {
  it('returns 1 for a bare <testsuite> root', () => {
    const [count] = callPure<[number]>([
      { fn: 'countTopLevelGroups', args: [smallReport] },
    ]);
    expect(count).toBe(1);
  });

  it('counts the top-level <testsuite> children of a <testsuites> root', () => {
    const xml =
      '<testsuites><testsuite name="a"><testcase name="a1"/></testsuite>' +
      '<testsuite name="b"><testcase name="b1"/></testsuite>' +
      '<testsuite name="c"><testcase name="c1"/></testsuite></testsuites>';

    const [count] = callPure<[number]>([
      { fn: 'countTopLevelGroups', args: [xml] },
    ]);
    expect(count).toBe(3);
  });

  it('matches the server when a top-level testsuite nests a differently-named child, instead of undercounting it', () => {
    const xml =
      '<testsuites><testsuite name="a"><testcase name="a1"/>' +
      '<testsuite name="a-nested"><testcase name="nested1"/></testsuite>' +
      '</testsuite></testsuites>';

    const [clientCount] = callPure<[number]>([
      { fn: 'countTopLevelGroups', args: [xml] },
    ]);

    const serverGroupCount = groupJunitReportBySuite(
      parseJunitXml(xml),
      'external-id',
    ).length;

    expect(clientCount).toBe(2);
    expect(clientCount).toBe(serverGroupCount);
  });

  it('matches the server for a bare <testsuite> root that nests a differently-named child', () => {
    const xml =
      '<testsuite name="a"><testcase name="a1"/>' +
      '<testsuite name="a-nested"><testcase name="nested1"/></testsuite>' +
      '</testsuite>';

    const [clientCount] = callPure<[number]>([
      { fn: 'countTopLevelGroups', args: [xml] },
    ]);

    const serverGroupCount = groupJunitReportBySuite(
      parseJunitXml(xml),
      'external-id',
    ).length;

    expect(clientCount).toBe(serverGroupCount);
  });

  it('matches the server for a pytest-style report with several classname-nested testsuites two levels deep', () => {
    const xml = `<testsuites name="pytest">
      <testsuite name="tests.checkout.test_checkout">
        <testsuite name="tests.checkout.test_checkout.TestAddItem">
          <testcase name="test_add_item"/>
          <testcase name="test_add_item_twice"/>
        </testsuite>
        <testsuite name="tests.checkout.test_checkout.TestRemoveItem">
          <testcase name="test_remove_item"/>
        </testsuite>
      </testsuite>
      <testsuite name="tests.cart.test_cart">
        <testcase name="test_add_to_cart"/>
      </testsuite>
    </testsuites>`;

    const [clientCount] = callPure<[number]>([
      { fn: 'countTopLevelGroups', args: [xml] },
    ]);

    const serverGroupCount = groupJunitReportBySuite(
      parseJunitXml(xml),
      'external-id',
    ).length;

    expect(clientCount).toBe(serverGroupCount);
  });

  it('matches the server for a surefire-style report with an unnamed nested testsuite inheriting its parent suite key', () => {
    const xml = `<testsuites>
      <testsuite name="com.qably.CheckoutTest">
        <testcase name="addsItem"/>
        <testsuite>
          <testcase name="removesItem"/>
        </testsuite>
      </testsuite>
    </testsuites>`;

    const [clientCount] = callPure<[number]>([
      { fn: 'countTopLevelGroups', args: [xml] },
    ]);

    const serverGroupCount = groupJunitReportBySuite(
      parseJunitXml(xml),
      'external-id',
    ).length;

    expect(clientCount).toBe(1);
    expect(clientCount).toBe(serverGroupCount);
  });

  it('merges two identically-named nested testsuites into a single group, exactly like the server', () => {
    const xml = `<testsuites>
      <testsuite name="src/a.test.ts"><testcase name="a1"/></testsuite>
      <testsuite name="src/a.test.ts"><testcase name="a2"/></testsuite>
    </testsuites>`;

    const [clientCount] = callPure<[number]>([
      { fn: 'countTopLevelGroups', args: [xml] },
    ]);

    const serverGroupCount = groupJunitReportBySuite(
      parseJunitXml(xml),
      'external-id',
    ).length;

    expect(clientCount).toBe(1);
    expect(clientCount).toBe(serverGroupCount);
  });

  it('matches the server when the same suite name is single-quoted in one testsuite and double-quoted in another', () => {
    const xml =
      '<testsuites>' +
      '<testsuite name=\'Checkout\'><testcase name="a1"/></testsuite>' +
      '<testsuite name="Checkout"><testcase name="a2"/></testsuite>' +
      '</testsuites>';

    const [clientCount] = callPure<[number]>([
      { fn: 'countTopLevelGroups', args: [xml] },
    ]);

    const serverGroupCount = groupJunitReportBySuite(
      parseJunitXml(xml),
      'external-id',
    ).length;

    expect(clientCount).toBe(1);
    expect(clientCount).toBe(serverGroupCount);
  });

  it('does not merge two suites whose numeric character references the server leaves undecoded, matching the server exactly', () => {
    const xml =
      '<testsuites>' +
      '<testsuite name="Cart &amp; Checkout"><testcase name="a1"/></testsuite>' +
      '<testsuite name="Cart &#38; Checkout"><testcase name="a2"/></testsuite>' +
      '</testsuites>';

    const [clientCount] = callPure<[number]>([
      { fn: 'countTopLevelGroups', args: [xml] },
    ]);

    const serverGroupCount = groupJunitReportBySuite(
      parseJunitXml(xml),
      'external-id',
    ).length;

    expect(clientCount).toBe(2);
    expect(clientCount).toBe(serverGroupCount);
  });

  it('decodes a named entity before truncating to 500 characters instead of truncating the raw entity text, so it does not falsely merge with an unrelated suite that only coincides in undecoded form', () => {
    const prefix = 'p'.repeat(496);
    const suiteA = `${prefix}&amp;${'q'.repeat(600)}`;
    const suiteB = `${prefix}&amp;amp`;
    const xml =
      '<testsuites>' +
      `<testsuite name="${suiteA}"><testcase name="a1"/></testsuite>` +
      `<testsuite name="${suiteB}"><testcase name="a2"/></testsuite>` +
      '</testsuites>';

    const [clientCount] = callPure<[number]>([
      { fn: 'countTopLevelGroups', args: [xml] },
    ]);

    const serverGroupCount = groupJunitReportBySuite(
      parseJunitXml(xml),
      'external-id',
    ).length;

    expect(clientCount).toBe(2);
    expect(clientCount).toBe(serverGroupCount);
  });
});

describe('buildRequestExternalId', () => {
  it('leaves the externalId unchanged when there is only one request', () => {
    const [id] = callPure<[string]>([
      { fn: 'buildRequestExternalId', args: ['base', 0, 1, true] },
    ]);
    expect(id).toBe('base');
  });

  it('leaves the externalId unchanged for multi-group chunks (already unique server-side)', () => {
    const [id] = callPure<[string]>([
      { fn: 'buildRequestExternalId', args: ['base', 1, 3, false] },
    ]);
    expect(id).toBe('base');
  });

  it('suffixes single-group chunks uniquely to avoid the server bare-externalId collision', () => {
    const results = callPure<string[]>([
      { fn: 'buildRequestExternalId', args: ['base', 0, 3, true] },
      { fn: 'buildRequestExternalId', args: ['base', 1, 3, true] },
      { fn: 'buildRequestExternalId', args: ['base', 2, 3, true] },
    ]);
    expect(new Set(results).size).toBe(3);
    expect(results).toEqual(['base-p1', 'base-p2', 'base-p3']);
  });
});

describe('deriveWorkspacePrefix and repoRelativeFilePaths', () => {
  it('derives the workspace from a conventional reports/ directory', () => {
    const [prefix] = callPure<[string]>([
      { fn: 'deriveWorkspacePrefix', args: ['apps/api/reports/junit.xml', {}] },
    ]);
    expect(prefix).toBe('apps/api');
  });

  it('honors QABLY_REPO_PATH_PREFIX as an override', () => {
    const [prefix] = callPure<[string]>([
      {
        fn: 'deriveWorkspacePrefix',
        args: ['reports/junit.xml', { QABLY_REPO_PATH_PREFIX: 'custom/path' }],
      },
    ]);
    expect(prefix).toBe('custom/path');
  });

  it('prefixes file attributes that are missing the workspace', () => {
    const xml = '<testcase name="a" file="src/a.test.ts"/>';
    const [result] = callPure<[string]>([
      { fn: 'repoRelativeFilePaths', args: [xml, 'apps/api'] },
    ]);
    expect(result).toBe('<testcase name="a" file="apps/api/src/a.test.ts"/>');
  });
});

describe('evaluateBaseUrlSecurity', () => {
  it('treats an https origin as secure', () => {
    const [result] = callPure<[{ secure: boolean }]>([
      { fn: 'evaluateBaseUrlSecurity', args: ['https://api.qably.dev'] },
    ]);
    expect(result.secure).toBe(true);
  });

  it.each([
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://[::1]:3001',
  ])('treats %s as secure even over plain http', (baseUrl) => {
    const [result] = callPure<[{ secure: boolean }]>([
      { fn: 'evaluateBaseUrlSecurity', args: [baseUrl] },
    ]);
    expect(result.secure).toBe(true);
  });

  it('flags a non-https, non-local origin as insecure with a reason', () => {
    const [result] = callPure<[{ secure: boolean; reason?: string }]>([
      { fn: 'evaluateBaseUrlSecurity', args: ['http://qably.dev'] },
    ]);
    expect(result.secure).toBe(false);
    expect(result.reason).toEqual(expect.stringContaining('qably.dev'));
  });

  it('flags an unparsable base url as insecure with a reason', () => {
    const [result] = callPure<[{ secure: boolean; reason?: string }]>([
      { fn: 'evaluateBaseUrlSecurity', args: ['not a url'] },
    ]);
    expect(result.secure).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

describe('buildIngestUrl', () => {
  it('includes only defined params and omits empty ones', () => {
    const [href] = callPure<[string]>([
      {
        fn: 'buildIngestUrl',
        args: [
          'https://api.qably.dev',
          {
            externalId: 'ext-1',
            source: 'github_actions',
            commitSha: undefined,
            commitMessage: '',
          },
        ],
      },
    ]);
    const url = new URL(href);
    expect(url.pathname).toBe('/runs/ingest/junit');
    expect(url.searchParams.get('externalId')).toBe('ext-1');
    expect(url.searchParams.get('source')).toBe('github_actions');
    expect(url.searchParams.has('commitSha')).toBe(false);
    expect(url.searchParams.has('commitMessage')).toBe(false);
  });

  it('carries the ci fields that have a value and drops the ones that do not', () => {
    const [href] = callPure<[string]>([
      {
        fn: 'buildIngestUrl',
        args: [
          'https://api.qably.dev',
          {
            externalId: 'ext-1',
            ciRunExternalId: '900',
            ciJobKey: 'test (node 20)',
            ciHeadRef: undefined,
            ciBranch: '',
          },
        ],
      },
    ]);
    const url = new URL(href);
    expect(url.searchParams.get('ciRunExternalId')).toBe('900');
    expect(url.searchParams.get('ciJobKey')).toBe('test (node 20)');
    expect(url.searchParams.has('ciHeadRef')).toBe(false);
    expect(url.searchParams.has('ciBranch')).toBe(false);
  });
});

interface JobIdentity {
  jobKey?: string;
  idSegment: string;
}

function externalIdsFor(
  filePath: string,
  envs: Array<Record<string, string>>,
): string[] {
  const script = `
    const mod = await import(${JSON.stringify(REPORTER_MODULE_URL)});
    const envs = ${JSON.stringify(envs)};
    const ids = envs.map((env) => mod.buildFileExternalId(${JSON.stringify(filePath)}, mod.buildContext(env)));
    process.stdout.write(JSON.stringify(ids));
  `;
  const result = runNodeEval(script);

  if (result.exitCode !== 0) {
    throw new Error(`harness script failed: ${result.stderr}`);
  }

  return JSON.parse(result.stdout) as string[];
}

describe('resolveJobIdentity', () => {
  it('shows QABLY_JOB_KEY untouched and slugs it for the external id', () => {
    const [matrix20, matrix22] = callPure<JobIdentity[]>([
      {
        fn: 'resolveJobIdentity',
        args: [{ QABLY_JOB_KEY: 'test (node 20)', GITHUB_JOB: 'test' }],
      },
      {
        fn: 'resolveJobIdentity',
        args: [{ QABLY_JOB_KEY: '  test (node 22)  ', GITHUB_JOB: 'test' }],
      },
    ]);

    expect(matrix20).toEqual({
      jobKey: 'test (node 20)',
      idSegment: 'test-node-20',
    });
    expect(matrix22).toEqual({
      jobKey: 'test (node 22)',
      idSegment: 'test-node-22',
    });
  });

  it('keeps GITHUB_JOB untransformed in the id segment while QABLY_JOB_KEY is absent', () => {
    const [upper, dotted] = callPure<JobIdentity[]>([
      { fn: 'resolveJobIdentity', args: [{ GITHUB_JOB: 'Build-API' }] },
      { fn: 'resolveJobIdentity', args: [{ GITHUB_JOB: 'test.unit' }] },
    ]);

    expect(upper).toEqual({ jobKey: 'Build-API', idSegment: 'Build-API' });
    expect(dotted).toEqual({ jobKey: 'test.unit', idSegment: 'test.unit' });
  });

  it('ignores a blank QABLY_JOB_KEY and falls back to GITHUB_JOB', () => {
    const [spaces, empty] = callPure<JobIdentity[]>([
      {
        fn: 'resolveJobIdentity',
        args: [{ QABLY_JOB_KEY: '  ', GITHUB_JOB: 'api' }],
      },
      {
        fn: 'resolveJobIdentity',
        args: [{ QABLY_JOB_KEY: '', GITHUB_JOB: 'api' }],
      },
    ]);

    expect(spaces).toEqual({ jobKey: 'api', idSegment: 'api' });
    expect(empty).toEqual({ jobKey: 'api', idSegment: 'api' });
  });

  it('has no job key and the legacy id segment when neither variable exists', () => {
    const [none] = callPure<JobIdentity[]>([
      { fn: 'resolveJobIdentity', args: [{}] },
    ]);

    expect(none.jobKey).toBeUndefined();
    expect(none.idSegment).toBe('job');
  });
});

describe('buildFileExternalId with a job identity', () => {
  const filePath = 'reports/junit-unit.xml';

  it('gives matrix variants of the same file different external ids', () => {
    const [node20, node22, withoutKey] = externalIdsFor(filePath, [
      {
        GITHUB_RUN_ID: '900',
        GITHUB_JOB: 'test',
        QABLY_JOB_KEY: 'test (node 20)',
      },
      {
        GITHUB_RUN_ID: '900',
        GITHUB_JOB: 'test',
        QABLY_JOB_KEY: 'test (node 22)',
      },
      { GITHUB_RUN_ID: '900', GITHUB_JOB: 'test' },
    ]);

    expect(node20).toBe('gha-900-test-node-20-junit-unit-xml-3425dd6f');
    expect(node22).toBe('gha-900-test-node-22-junit-unit-xml-3425dd6f');
    expect(withoutKey).toBe('gha-900-test-junit-unit-xml-3425dd6f');
  });

  it('regenerates the 10.0.0 external id byte for byte while QABLY_JOB_KEY is absent', () => {
    const [local, simple, upper, dotted] = externalIdsFor(filePath, [
      {},
      { GITHUB_RUN_ID: '900', GITHUB_JOB: 'api' },
      { GITHUB_RUN_ID: '900', GITHUB_JOB: 'Build-API' },
      { GITHUB_RUN_ID: '901', GITHUB_JOB: 'test.unit' },
    ]);

    expect(local).toBe('gha-local-job-junit-unit-xml-3425dd6f');
    expect(simple).toBe('gha-900-api-junit-unit-xml-3425dd6f');
    expect(upper).toBe('gha-900-Build-API-junit-unit-xml-3425dd6f');
    expect(dotted).toBe('gha-901-test.unit-junit-unit-xml-3425dd6f');
  });
});

describe('REPORT_VERSION', () => {
  it('is 10.1.0 now that the reporter sends CI metadata', () => {
    const result = runNodeEval(`
      const mod = await import(${JSON.stringify(REPORTER_MODULE_URL)});
      process.stdout.write(mod.REPORT_VERSION);
    `);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('10.1.0');
  });
});

type CiFields = Record<string, string>;

interface ContextShape {
  idSegment: string;
  runId: string;
  ci: CiFields;
}

describe('buildContext CI metadata', () => {
  it('reads every ci field from the real environment', () => {
    const [context] = callPure<ContextShape[]>([
      {
        fn: 'buildContext',
        args: [
          {
            GITHUB_RUN_ID: '900',
            GITHUB_JOB: 'api',
            GITHUB_WORKFLOW: 'CI',
            GITHUB_RUN_NUMBER: '42',
            GITHUB_RUN_ATTEMPT: '1',
            GITHUB_REF_NAME: 'main',
            GITHUB_HEAD_REF: '',
            GITHUB_ACTOR: 'ana',
            GITHUB_EVENT_NAME: 'push',
            GITHUB_SERVER_URL: 'https://github.com',
            GITHUB_REPOSITORY: 'acme/shop',
          },
        ],
      },
    ]);

    expect(context.ci).toEqual({
      ciRunExternalId: '900',
      ciJobKey: 'api',
      ciWorkflowName: 'CI',
      ciRunNumber: '42',
      ciRunAttempt: '1',
      ciBranch: 'main',
      ciActor: 'ana',
      ciEventName: 'push',
      ciServerUrl: 'https://github.com',
      ciRepository: 'acme/shop',
    });
  });

  it('sends only the variables that exist, with no empty values', () => {
    const [partial, jobOnly] = callPure<ContextShape[]>([
      {
        fn: 'buildContext',
        args: [{ GITHUB_RUN_ID: '900', GITHUB_JOB: 'api' }],
      },
      { fn: 'buildContext', args: [{ GITHUB_ACTOR: 'ana' }] },
    ]);

    expect(partial.ci).toEqual({ ciRunExternalId: '900', ciJobKey: 'api' });
    expect(jobOnly.ci).toEqual({ ciActor: 'ana' });
  });

  it('derives no ci field from the defaulted context of a local run', () => {
    const [local] = callPure<ContextShape[]>([
      { fn: 'buildContext', args: [{}] },
    ]);

    expect(local.runId).toBe('local');
    expect(local.idSegment).toBe('job');
    expect(local.ci).toEqual({});
  });

  it('uses QABLY_JOB_KEY, raw, as ciJobKey', () => {
    const [context] = callPure<ContextShape[]>([
      {
        fn: 'buildContext',
        args: [
          {
            GITHUB_RUN_ID: '900',
            GITHUB_JOB: 'test',
            QABLY_JOB_KEY: 'test (node 20)',
          },
        ],
      },
    ]);

    expect(context.ci).toEqual({
      ciRunExternalId: '900',
      ciJobKey: 'test (node 20)',
    });
  });

  it('omits blank values and counters that are not positive integers', () => {
    const invalidNumbers = ['abc', '0', '-1', '1.5', '', '99999999999'];
    const results = callPure<ContextShape[]>([
      { fn: 'buildContext', args: [{ GITHUB_JOB: '  ', GITHUB_RUN_ID: '  ' }] },
      ...invalidNumbers.map((value) => ({
        fn: 'buildContext',
        args: [{ GITHUB_RUN_NUMBER: value, GITHUB_RUN_ATTEMPT: value }],
      })),
      {
        fn: 'buildContext',
        args: [{ GITHUB_RUN_NUMBER: ' 7 ', GITHUB_RUN_ATTEMPT: '2' }],
      },
    ]);

    expect(results).toHaveLength(invalidNumbers.length + 2);
    expect(results[0].ci).toEqual({});
    for (const context of results.slice(1, -1)) {
      expect(context.ci).toEqual({});
    }
    expect(results[results.length - 1].ci).toEqual({
      ciRunNumber: '7',
      ciRunAttempt: '2',
    });
  });

  it('truncates a string field to 255 characters', () => {
    const [context] = callPure<ContextShape[]>([
      {
        fn: 'buildContext',
        args: [{ GITHUB_REF_NAME: 'b'.repeat(300) }],
      },
    ]);

    expect(context.ci.ciBranch).toBe('b'.repeat(255));
  });

  it('keeps the pull request merge ref and the head ref apart', () => {
    const [context] = callPure<ContextShape[]>([
      {
        fn: 'buildContext',
        args: [{ GITHUB_REF_NAME: '12/merge', GITHUB_HEAD_REF: 'feature/x' }],
      },
    ]);

    expect(context.ci).toEqual({
      ciBranch: '12/merge',
      ciHeadRef: 'feature/x',
    });
  });

  it('omits a server url the API would reject, instead of losing the whole report to a 400', () => {
    const rejected = [
      'javascript:alert(1)',
      'ftp://x',
      'github.com',
      `https://${'h'.repeat(260)}.example`,
    ];
    const results = callPure<ContextShape[]>([
      ...rejected.map((value) => ({
        fn: 'buildContext',
        args: [{ GITHUB_SERVER_URL: value }],
      })),
      {
        fn: 'buildContext',
        args: [{ GITHUB_SERVER_URL: 'https://ghe.example.com' }],
      },
      { fn: 'buildContext', args: [{ GITHUB_SERVER_URL: 'http://ghe.local' }] },
    ]);

    expect(results).toHaveLength(rejected.length + 2);
    for (const context of results.slice(0, rejected.length)) {
      expect(context.ci).toEqual({});
    }
    expect(results[rejected.length].ci).toEqual({
      ciServerUrl: 'https://ghe.example.com',
    });
    expect(results[rejected.length + 1].ci).toEqual({
      ciServerUrl: 'http://ghe.local',
    });
  });
});

describe('resolveInputPaths', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'qably-report-'));
    mkdirSync(join(dir, 'reports'));
    writeFileSync(join(dir, 'reports', 'a.xml'), smallReport);
    writeFileSync(join(dir, 'reports', 'b.xml'), smallReport);
    writeFileSync(join(dir, 'reports', 'ignore.txt'), 'not xml');
    mkdirSync(join(dir, 'reports', 'unit'));
    writeFileSync(join(dir, 'reports', 'unit', 'junit.xml'), smallReport);
    mkdirSync(join(dir, 'reports', 'unit', 'nested'));
    writeFileSync(
      join(dir, 'reports', 'unit', 'nested', 'deep.xml'),
      smallReport,
    );
    mkdirSync(join(dir, 'empty-reports'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('lists every *.xml file directly inside a directory argument, recursing into subdirectories', () => {
    const [result] = callPure<[{ files: string[]; emptyArgs: string[] }]>([
      { fn: 'resolveInputPaths', args: [[join(dir, 'reports')], dir] },
    ]);
    expect(result.files.sort()).toEqual(
      [
        join(dir, 'reports', 'a.xml'),
        join(dir, 'reports', 'b.xml'),
        join(dir, 'reports', 'unit', 'junit.xml'),
        join(dir, 'reports', 'unit', 'nested', 'deep.xml'),
      ].sort(),
    );
    expect(result.emptyArgs).toEqual([]);
  });

  it('returns the same file list on repeated calls, sorted deterministically', () => {
    const [first] = callPure<[{ files: string[] }]>([
      { fn: 'resolveInputPaths', args: [[join(dir, 'reports')], dir] },
    ]);
    const [second] = callPure<[{ files: string[] }]>([
      { fn: 'resolveInputPaths', args: [[join(dir, 'reports')], dir] },
    ]);
    expect(first.files).toEqual(second.files);
  });

  it('expands a glob pattern to matching files', () => {
    const pattern = join(dir, 'reports', '*.xml').replace(/\\/g, '/');
    const [result] = callPure<[{ files: string[]; emptyArgs: string[] }]>([
      { fn: 'resolveInputPaths', args: [[pattern], dir] },
    ]);
    expect(result.files).toHaveLength(2);
    expect(result.emptyArgs).toEqual([]);
  });

  it('passes through a literal path even when the file does not exist, for the caller to warn on', () => {
    const missing = join(dir, 'reports', 'missing.xml');
    const [result] = callPure<[{ files: string[]; emptyArgs: string[] }]>([
      { fn: 'resolveInputPaths', args: [[missing], dir] },
    ]);
    expect(result.files).toEqual([missing]);
    expect(result.emptyArgs).toEqual([]);
  });

  it('reports an argument that resolves to zero files as an empty argument, without dropping matches from other arguments', () => {
    const [result] = callPure<[{ files: string[]; emptyArgs: string[] }]>([
      {
        fn: 'resolveInputPaths',
        args: [[join(dir, 'reports'), join(dir, 'empty-reports')], dir],
      },
    ]);
    expect(result.files.sort()).toEqual(
      [
        join(dir, 'reports', 'a.xml'),
        join(dir, 'reports', 'b.xml'),
        join(dir, 'reports', 'unit', 'junit.xml'),
        join(dir, 'reports', 'unit', 'nested', 'deep.xml'),
      ].sort(),
    );
    expect(result.emptyArgs).toEqual([join(dir, 'empty-reports')]);
  });

  it('reports a glob that matches nothing as an empty argument', () => {
    const pattern = join(dir, 'reports', '*.does-not-exist').replace(
      /\\/g,
      '/',
    );
    const [result] = callPure<[{ files: string[]; emptyArgs: string[] }]>([
      { fn: 'resolveInputPaths', args: [[pattern], dir] },
    ]);
    expect(result.files).toEqual([]);
    expect(result.emptyArgs).toEqual([pattern]);
  });
});

type ScriptedResponse = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

function createScriptedServer(
  script: (callIndex: number, req: IncomingMessage) => ScriptedResponse,
): Promise<{ server: Server; url: string; calls: () => number }> {
  let callCount = 0;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    req.on('data', () => {});
    req.on('end', () => {
      const index = callCount;
      callCount += 1;
      const response = script(index, req);
      const headers = response.headers ?? {};
      for (const [key, value] of Object.entries(headers))
        res.setHeader(key, value);
      res.statusCode = response.status;
      res.end(response.body === undefined ? '' : JSON.stringify(response.body));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port =
        typeof address === 'object' && address !== null ? address.port : 0;
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        calls: () => callCount,
      });
    });
  });
}

function createHangingServer(): Promise<{ server: Server; url: string }> {
  const server = createServer((req: IncomingMessage) => {
    req.on('data', () => {});
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port =
        typeof address === 'object' && address !== null ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function writeReport(dir: string, name: string, xml: string): string {
  const filePath = join(dir, name);
  writeFileSync(filePath, xml);
  return filePath;
}

async function ingestQueriesFor(
  dir: string,
  env: Record<string, string>,
): Promise<{ queries: URLSearchParams[]; exitCode: number | null }> {
  const queries: URLSearchParams[] = [];
  const { server, url } = await createScriptedServer((_, req) => {
    queries.push(new URL(req.url ?? '', 'http://localhost').searchParams);
    return { status: 202, body: { accepted: 1, runs: [] } };
  });

  try {
    const filePath = writeReport(dir, 'report.xml', smallReport);
    const result = await runCli([filePath], {
      QABLY_API_KEY: 'key',
      QABLY_API_BASE_URL: url,
      ...env,
    });

    return { queries, exitCode: result.exitCode };
  } finally {
    server.close();
  }
}

function ciParamsOf(query: URLSearchParams): Record<string, string> {
  return Object.fromEntries(
    [...query.entries()].filter(([key]) => key.startsWith('ci')),
  );
}

describe('CLI end-to-end against a fake ingest server', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qably-cli-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports a healthy file in one request and prints a runs/cases summary', async () => {
    const { server, url, calls } = await createScriptedServer(() => ({
      status: 202,
      body: {
        accepted: 1,
        runs: [{ externalId: 'x', suiteName: 'Checkout', jobId: 'j' }],
      },
    }));

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const result = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
      });

      expect(calls()).toBe(1);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('1 runs, 2 cases');
    } finally {
      server.close();
    }
  });

  it('annotates a rejected group as a warning and treats it as a failure only under QABLY_FAIL_ON_ERROR', async () => {
    const { server, url } = await createScriptedServer(() => ({
      status: 202,
      body: {
        accepted: 0,
        runs: [],
        rejected: [{ suiteName: 'Checkout', reason: 'name: too long' }],
        caseIdentityCollisions: [],
        truncatedFields: {},
      },
    }));

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const withoutFailOnError = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
      });

      expect(withoutFailOnError.exitCode).toBe(0);
      expect(withoutFailOnError.stdout).toContain('[warning]');
      expect(withoutFailOnError.stdout).toContain('Checkout');
      expect(withoutFailOnError.stdout).toContain('name: too long');

      const withFailOnError = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
        QABLY_FAIL_ON_ERROR: 'true',
      });

      expect(withFailOnError.exitCode).toBe(1);
    } finally {
      server.close();
    }
  });

  it('annotates a case identity collision as a warning that also fails the job under QABLY_FAIL_ON_ERROR', async () => {
    const { server, url } = await createScriptedServer(() => ({
      status: 202,
      body: {
        accepted: 1,
        runs: [{ externalId: 'x', suiteName: 'Checkout', jobId: 'j' }],
        rejected: [],
        caseIdentityCollisions: [
          { suiteName: 'Checkout', key: 'Adds to cart', count: 2 },
        ],
        truncatedFields: {},
      },
    }));

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const withoutFailOnError = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
      });

      expect(withoutFailOnError.exitCode).toBe(0);
      expect(withoutFailOnError.stdout).toContain('[warning]');
      expect(withoutFailOnError.stdout).toContain('Adds to cart');

      const withFailOnError = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
        QABLY_FAIL_ON_ERROR: 'true',
      });

      expect(withFailOnError.exitCode).toBe(1);
    } finally {
      server.close();
    }
  });

  it('annotates truncated field counts as a notice, never as a failure', async () => {
    const { server, url } = await createScriptedServer(() => ({
      status: 202,
      body: {
        accepted: 1,
        runs: [{ externalId: 'x', suiteName: 'Checkout', jobId: 'j' }],
        rejected: [],
        caseIdentityCollisions: [],
        truncatedFields: { name: 2, failureMessage: 1 },
      },
    }));

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const result = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
        QABLY_FAIL_ON_ERROR: 'true',
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[notice]');
      expect(result.stdout).toContain('name: 2');
      expect(result.stdout).toContain('failureMessage: 1');
    } finally {
      server.close();
    }
  });

  it('retries once on a 429 and honors Retry-After', async () => {
    const { server, url, calls } = await createScriptedServer((index) => {
      if (index === 0) return { status: 429, headers: { 'retry-after': '0' } };
      return { status: 202, body: { accepted: 1, runs: [] } };
    });

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const result = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
      });

      expect(calls()).toBe(2);
      expect(result.exitCode).toBe(0);
    } finally {
      server.close();
    }
  });

  it('retries a 5xx with backoff and eventually succeeds', async () => {
    const { server, url, calls } = await createScriptedServer((index) => {
      if (index < 2) return { status: 503 };
      return { status: 202, body: { accepted: 1, runs: [] } };
    });

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const result = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
      });

      expect(calls()).toBe(3);
      expect(result.exitCode).toBe(0);
    } finally {
      server.close();
    }
  }, 15_000);

  it('never retries a non-429 4xx response', async () => {
    const { server, url, calls } = await createScriptedServer(() => ({
      status: 400,
      body: { message: 'bad xml' },
    }));

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const result = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
      });

      expect(calls()).toBe(1);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[warning]');
      expect(result.stdout).toContain('rejected (400)');
    } finally {
      server.close();
    }
  });

  it('exhausts retries on a persistent 5xx, warns, and exits 0 by default', async () => {
    const { server, url, calls } = await createScriptedServer(() => ({
      status: 500,
    }));

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const result = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
      });

      expect(calls()).toBe(4);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[warning]');
    } finally {
      server.close();
    }
  }, 30_000);

  it('turns the same persistent failure into a non-zero exit when QABLY_FAIL_ON_ERROR=true', async () => {
    const { server, url } = await createScriptedServer(() => ({ status: 500 }));

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const result = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
        QABLY_FAIL_ON_ERROR: 'true',
      });

      expect(result.exitCode).toBe(1);
    } finally {
      server.close();
    }
  }, 30_000);

  it('treats a hanging response as a retryable network error via the fetch timeout, and eventually gives up', async () => {
    const { server, url } = await createHangingServer();

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const result = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
        QABLY_REPORT_TIMEOUT_MS: '100',
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[warning]');
    } finally {
      server.close();
    }
  }, 20_000);

  it('never fails the job on a network error and reports it as a warning', async () => {
    const filePath = writeReport(dir, 'report.xml', smallReport);
    const result = await runCli([filePath], {
      QABLY_API_KEY: 'key',
      QABLY_API_BASE_URL: 'http://127.0.0.1:1',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('[warning]');
  }, 30_000);

  it('refuses to send the api key over an insecure, non-local QABLY_API_BASE_URL when QABLY_FAIL_ON_ERROR=true', async () => {
    const filePath = writeReport(dir, 'report.xml', smallReport);
    const result = await runCli([filePath], {
      QABLY_API_KEY: 'key',
      QABLY_API_BASE_URL: 'http://example.invalid',
      QABLY_FAIL_ON_ERROR: 'true',
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('[error]');
  }, 10_000);

  it('warns and exits 0 when QABLY_API_KEY is missing, without calling the server', async () => {
    const { server, url, calls } = await createScriptedServer(() => ({
      status: 202,
      body: {},
    }));

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const result = await runCli([filePath], {
        QABLY_API_KEY: undefined,
        QABLY_API_BASE_URL: url,
      });

      expect(calls()).toBe(0);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('QABLY_API_KEY is not set');
    } finally {
      server.close();
    }
  });

  it('warns and continues past a missing report file instead of failing the job', async () => {
    const missing = join(dir, 'does-not-exist.xml');
    const result = await runCli([missing], {
      QABLY_API_KEY: 'key',
      QABLY_API_BASE_URL: 'http://127.0.0.1:1',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('could not read');
  });

  it('prints GitHub annotation syntax when GITHUB_ACTIONS=true, plain lines otherwise', async () => {
    const { server, url } = await createScriptedServer(() => ({
      status: 202,
      body: { accepted: 1, runs: [] },
    }));

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const withActions = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
        GITHUB_ACTIONS: 'true',
      });
      expect(withActions.stdout).toContain('::notice title=');

      const withoutActions = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
        GITHUB_ACTIONS: undefined,
      });
      expect(withoutActions.stdout).toContain('[notice]');
      expect(withoutActions.stdout).not.toContain('::notice');
    } finally {
      server.close();
    }
  });

  it('warns about an argument that matched zero files while still reporting the ones that did match', async () => {
    const { server, url, calls } = await createScriptedServer(() => ({
      status: 202,
      body: { accepted: 1, runs: [] },
    }));

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      mkdirSync(join(dir, 'empty-dir'));
      const result = await runCli([filePath, join(dir, 'empty-dir')], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
      });

      expect(calls()).toBe(1);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[warning]');
      expect(result.stdout).toContain('matched no report files');
    } finally {
      server.close();
    }
  });

  it('fails the job for an argument that matched zero files when QABLY_FAIL_ON_ERROR=true', async () => {
    const { server, url } = await createScriptedServer(() => ({
      status: 202,
      body: { accepted: 1, runs: [] },
    }));

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      mkdirSync(join(dir, 'empty-dir-2'));
      const result = await runCli([filePath, join(dir, 'empty-dir-2')], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
        QABLY_FAIL_ON_ERROR: 'true',
      });

      expect(result.exitCode).toBe(1);
    } finally {
      server.close();
    }
  });

  it('recurses into a nested reports directory and reports every xml file found, including subdirectories', async () => {
    const { server, url, calls } = await createScriptedServer(() => ({
      status: 202,
      body: { accepted: 1, runs: [] },
    }));

    try {
      mkdirSync(join(dir, 'reports', 'unit'), { recursive: true });
      writeReport(dir, 'reports/a.xml', smallReport);
      writeReport(dir, 'reports/unit/junit.xml', smallReport);
      const result = await runCli([join(dir, 'reports')], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
      });

      expect(calls()).toBe(2);
      expect(result.exitCode).toBe(0);
    } finally {
      server.close();
    }
  });

  it('resolves a glob argument and reports every matched file', async () => {
    const { server, url, calls } = await createScriptedServer(() => ({
      status: 202,
      body: { accepted: 1, runs: [] },
    }));

    try {
      writeReport(dir, 'a.xml', smallReport);
      writeReport(dir, 'b.xml', smallReport);
      const pattern = join(dir, '*.xml').replace(/\\/g, '/');
      const result = await runCli([pattern], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
      });

      expect(calls()).toBe(2);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('across 2 file(s)');
    } finally {
      server.close();
    }
  });

  it('splits an oversized report into multiple requests with distinct externalIds, honoring the group cap', async () => {
    const externalIds: string[] = [];
    const { server, url, calls } = await createScriptedServer((_, req) => {
      const requestUrl = new URL(req.url ?? '', 'http://localhost');
      externalIds.push(requestUrl.searchParams.get('externalId') ?? '');
      return { status: 202, body: { accepted: 1, runs: [] } };
    });

    try {
      const suites = Array.from({ length: 501 }, (_, i) => i)
        .map(
          (i) => `<testsuite name="s${i}"><testcase name="c${i}"/></testsuite>`,
        )
        .join('');
      const oversized = `<testsuites>${suites}</testsuites>`;
      const filePath = writeReport(dir, 'oversized.xml', oversized);
      const result = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
      });

      expect(calls()).toBe(2);
      expect(new Set(externalIds).size).toBe(2);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('splitting into 2 requests');
    } finally {
      server.close();
    }
  }, 15_000);

  it('carries the same total reportSize on every chunk of a split report, so the server can aggregate one notification for the whole file', async () => {
    const reportSizes: string[] = [];
    const { server, url, calls } = await createScriptedServer((_, req) => {
      const requestUrl = new URL(req.url ?? '', 'http://localhost');
      reportSizes.push(requestUrl.searchParams.get('reportSize') ?? '');
      return { status: 202, body: { accepted: 1, runs: [] } };
    });

    try {
      const suites = Array.from({ length: 501 }, (_, i) => i)
        .map(
          (i) => `<testsuite name="s${i}"><testcase name="c${i}"/></testsuite>`,
        )
        .join('');
      const oversized = `<testsuites>${suites}</testsuites>`;
      const filePath = writeReport(dir, 'oversized.xml', oversized);
      const result = await runCli([filePath], {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
      });

      expect(calls()).toBe(2);
      expect(reportSizes).toEqual(['501', '501']);
      expect(result.exitCode).toBe(0);
    } finally {
      server.close();
    }
  }, 15_000);

  it('puts the QABLY_JOB_KEY slug in the sent externalId, so matrix variants of one file stop overwriting each other', async () => {
    const externalIds: string[] = [];
    const { server, url } = await createScriptedServer((_, req) => {
      const requestUrl = new URL(req.url ?? '', 'http://localhost');
      externalIds.push(requestUrl.searchParams.get('externalId') ?? '');
      return { status: 202, body: { accepted: 1, runs: [] } };
    });

    try {
      const filePath = writeReport(dir, 'report.xml', smallReport);
      const base = {
        QABLY_API_KEY: 'key',
        QABLY_API_BASE_URL: url,
        GITHUB_RUN_ID: '900',
        GITHUB_JOB: 'test',
      };
      await runCli([filePath], { ...base, QABLY_JOB_KEY: 'test (node 20)' });
      await runCli([filePath], { ...base, QABLY_JOB_KEY: 'test (node 22)' });
      await runCli([filePath], base);

      expect(externalIds).toHaveLength(3);
      expect(externalIds[0]).toMatch(/^gha-900-test-node-20-report-xml-\w{8}$/);
      expect(externalIds[1]).toMatch(/^gha-900-test-node-22-report-xml-\w{8}$/);
      expect(externalIds[2]).toMatch(/^gha-900-test-report-xml-\w{8}$/);
    } finally {
      server.close();
    }
  }, 15_000);

  it('sends every ci field of a real GitHub Actions environment on the ingest request', async () => {
    const { queries, exitCode } = await ingestQueriesFor(dir, {
      GITHUB_ACTIONS: 'true',
      GITHUB_RUN_ID: '900',
      GITHUB_JOB: 'api',
      GITHUB_WORKFLOW: 'CI',
      GITHUB_RUN_NUMBER: '42',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_REF_NAME: 'main',
      GITHUB_ACTOR: 'ana',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'acme/shop',
    });

    expect(exitCode).toBe(0);
    expect(queries).toHaveLength(1);
    expect(ciParamsOf(queries[0])).toEqual({
      ciRunExternalId: '900',
      ciJobKey: 'api',
      ciWorkflowName: 'CI',
      ciRunNumber: '42',
      ciRunAttempt: '1',
      ciBranch: 'main',
      ciActor: 'ana',
      ciEventName: 'push',
      ciServerUrl: 'https://github.com',
      ciRepository: 'acme/shop',
    });
    expect(queries[0].get('source')).toBe('github_actions');
  }, 15_000);

  it('sends only the ci fields whose variables exist, with no empty parameter', async () => {
    const { queries, exitCode } = await ingestQueriesFor(dir, {
      GITHUB_RUN_ID: '900',
      GITHUB_JOB: 'api',
    });

    expect(exitCode).toBe(0);
    expect(queries).toHaveLength(1);
    expect(ciParamsOf(queries[0])).toEqual({
      ciRunExternalId: '900',
      ciJobKey: 'api',
    });
  }, 15_000);

  it('sends the request without any ci field for a local run, instead of inventing a run called local', async () => {
    const { queries, exitCode } = await ingestQueriesFor(dir, {});

    expect(exitCode).toBe(0);
    expect(queries).toHaveLength(1);
    expect(ciParamsOf(queries[0])).toEqual({});
    expect(queries[0].get('externalId')).toMatch(
      /^gha-local-job-report-xml-\w{8}$/,
    );
    expect(queries[0].get('source')).toBe('api');
  }, 15_000);

  it('sends both the merge ref and the head ref on a pull request', async () => {
    const { queries, exitCode } = await ingestQueriesFor(dir, {
      GITHUB_ACTIONS: 'true',
      GITHUB_RUN_ID: '901',
      GITHUB_REF_NAME: '12/merge',
      GITHUB_HEAD_REF: 'feature/x',
      GITHUB_EVENT_NAME: 'pull_request',
    });

    expect(exitCode).toBe(0);
    expect(queries).toHaveLength(1);
    expect(ciParamsOf(queries[0])).toEqual({
      ciRunExternalId: '901',
      ciBranch: '12/merge',
      ciHeadRef: 'feature/x',
      ciEventName: 'pull_request',
    });
  }, 15_000);
});
