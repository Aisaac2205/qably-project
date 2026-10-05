import {
  REPORTER_MODULE_URL,
  callPure,
  runNodeEval,
} from '../../../reporter/test-support';
import { groupJunitReportBySuite } from './group-junit-report';
import { parseCiRunExternalId, resolveCiJobKey } from './ci-external-id';

const FILE_PATH = 'reports/junit-unit.xml';

function reporterExternalIds(
  envs: Array<Record<string, string>>,
  filePath = FILE_PATH,
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

function reporterExternalId(env: Record<string, string>): string {
  return reporterExternalIds([env])[0];
}

const run = (runId: string, jobEnv: Record<string, string>) => ({
  GITHUB_RUN_ID: runId,
  ...jobEnv,
});

describe('parseCiRunExternalId', () => {
  it.each([
    ['gha-900-api-junit-unit-xml-ab12cd34', '900'],
    ['gha-900-api-junit-xml-ab12cd34-p2', '900'],
    ['gha-18446744073-web-junit-xml-cd34ef56', '18446744073'],
    ['gha-900-Build-API-junit-unit-xml-3425dd6f', '900'],
  ])('extracts the numeric run id from %s', (externalId, expected) => {
    expect(parseCiRunExternalId(externalId)).toBe(expected);
  });

  it.each<string | null | undefined>([
    'gha-local-job-junit-xml-ab12cd34',
    'gha-abc-api-junit-xml-ab12cd34',
    'gha-900',
    'run-900-api',
    '900',
    '',
    null,
    undefined,
  ])('returns undefined for %s', (externalId) => {
    expect(parseCiRunExternalId(externalId)).toBeUndefined();
  });

  it('accepts a run id of 20 digits and rejects one of 21', () => {
    const twenty = '9'.repeat(20);
    const twentyOne = '9'.repeat(21);

    expect(parseCiRunExternalId(`gha-${twenty}-api-junit-xml-ab12cd34`)).toBe(
      twenty,
    );
    expect(
      parseCiRunExternalId(`gha-${twentyOne}-api-junit-xml-ab12cd34`),
    ).toBeUndefined();
  });

  it('reads the run id of an id the reporter produced, and nothing for a local one', () => {
    const [ci, local] = reporterExternalIds([
      run('900', { GITHUB_JOB: 'api' }),
      {},
    ]);

    expect(parseCiRunExternalId(ci)).toBe('900');
    expect(parseCiRunExternalId(local)).toBeUndefined();
  });
});

describe('resolveCiJobKey with ids produced by the reporter', () => {
  it('returns the job key of a plain GITHUB_JOB', () => {
    const externalId = reporterExternalId(run('900', { GITHUB_JOB: 'api' }));

    expect(resolveCiJobKey(externalId, '900', ['web', 'api', 'landing'])).toBe(
      'api',
    );
  });

  it('matches a GITHUB_JOB that keeps its case and punctuation in the id', () => {
    const [upper, dotted] = reporterExternalIds([
      run('900', { GITHUB_JOB: 'Build-API' }),
      run('900', { GITHUB_JOB: 'test.unit' }),
    ]);

    expect(upper).toContain('-Build-API-');
    expect(resolveCiJobKey(upper, '900', ['build-api', 'Build-API'])).toBe(
      'Build-API',
    );
    expect(resolveCiJobKey(dotted, '900', ['test', 'test.unit'])).toBe(
      'test.unit',
    );
  });

  it('matches a QABLY_JOB_KEY through the slug the reporter put in the id', () => {
    const [node20, node22] = reporterExternalIds([
      run('900', { GITHUB_JOB: 'test', QABLY_JOB_KEY: 'test (node 20)' }),
      run('900', { GITHUB_JOB: 'test', QABLY_JOB_KEY: 'test (node 22)' }),
    ]);
    const known = ['test', 'test (node 20)', 'test (node 22)'];

    expect(node20).toContain('-test-node-20-');
    expect(resolveCiJobKey(node20, '900', known)).toBe('test (node 20)');
    expect(resolveCiJobKey(node22, '900', known)).toBe('test (node 22)');
  });

  it('matches a key made only of symbols through the report fallback slug', () => {
    const externalId = reporterExternalId(
      run('900', { GITHUB_JOB: 'test', QABLY_JOB_KEY: '()' }),
    );

    expect(externalId).toContain('gha-900-report-');
    expect(resolveCiJobKey(externalId, '900', ['()', 'test'])).toBe('()');
  });

  it('finds a job key that itself contains hyphens by testing known keys, not by splitting', () => {
    const externalId = reporterExternalId(
      run('900', { GITHUB_JOB: 'build-web-app' }),
    );

    expect(
      resolveCiJobKey(externalId, '900', ['api', 'build-web-app', 'web']),
    ).toBe('build-web-app');
  });

  it('keeps resolving after the split and group suffixes the server appends', () => {
    const base = reporterExternalId(run('900', { GITHUB_JOB: 'api' }));
    const [split] = callPure<[string]>([
      { fn: 'buildRequestExternalId', args: [base, 1, 3, true] },
    ]);
    const [group] = groupJunitReportBySuite(
      {
        suiteName: 'root',
        suiteKey: 'root',
        cases: [
          {
            name: 'a',
            suiteName: 'src/a.test.ts',
            suiteKey: 'a',
            status: 'pass',
          },
          {
            name: 'b',
            suiteName: 'src/b.test.ts',
            suiteKey: 'b',
            status: 'pass',
          },
        ],
        truncatedFieldCounts: {},
      },
      base,
    );

    expect(split).toMatch(/-p2$/);
    expect(group.externalId.length).toBeGreaterThan(base.length);
    expect(resolveCiJobKey(split, '900', ['api'])).toBe('api');
    expect(resolveCiJobKey(group.externalId, '900', ['api'])).toBe('api');
  });
});

describe('resolveCiJobKey rules', () => {
  const external = 'gha-900-api-junit-unit-xml-ab12cd34';

  it('prefers the longest known key when a shorter one is also a prefix', () => {
    expect(
      resolveCiJobKey('gha-900-build-web-junit-xml-ab12cd34', '900', [
        'build',
        'build-web',
      ]),
    ).toBe('build-web');
  });

  it('prefers the longest match across a raw key and a slugged key', () => {
    expect(
      resolveCiJobKey('gha-900-build-web-junit-xml-ab12cd34', '900', [
        'build',
        'Build Web',
      ]),
    ).toBe('Build Web');
  });

  it('prefers the exact key over a different key that slugs to the same segment', () => {
    expect(
      resolveCiJobKey('gha-900-build-junit-xml-ab12cd34', '900', [
        'Build',
        'build',
      ]),
    ).toBe('build');
  });

  it('refuses to choose between two keys that only match through the same slug', () => {
    expect(
      resolveCiJobKey('gha-900-build-api-junit-xml-ab12cd34', '900', [
        'Build API',
        'build_api',
      ]),
    ).toBeUndefined();
  });

  it('returns undefined when no known key matches', () => {
    expect(
      resolveCiJobKey(external, '900', ['web', 'landing']),
    ).toBeUndefined();
    expect(resolveCiJobKey(external, '900', [])).toBeUndefined();
  });

  it('needs the hyphen after the key, so a key never matches half of a longer segment', () => {
    expect(resolveCiJobKey(external, '900', ['ap'])).toBeUndefined();
    expect(
      resolveCiJobKey(external, '900', ['api-junit-unit-xml-ab12cd34']),
    ).toBeUndefined();
  });

  it('needs the exact run id, so one id never matches the prefix of another', () => {
    expect(resolveCiJobKey(external, '90', ['api'])).toBeUndefined();
    expect(resolveCiJobKey(external, '9000', ['api'])).toBeUndefined();
    expect(resolveCiJobKey(external, '901', ['api'])).toBeUndefined();
  });

  it('ignores a key that only appears later in the id, such as in the file slug', () => {
    expect(
      resolveCiJobKey('gha-900-web-junit-api-xml-ab12cd34', '900', ['api']),
    ).toBeUndefined();
  });

  it('returns undefined for an id that is not from the reporter', () => {
    expect(
      resolveCiJobKey('gha-local-job-junit-xml-ab12cd34', '900', ['job']),
    ).toBeUndefined();
    expect(resolveCiJobKey('ci-run-42', '900', ['api'])).toBeUndefined();
    expect(resolveCiJobKey(null, '900', ['api'])).toBeUndefined();
    expect(resolveCiJobKey(undefined, '900', ['api'])).toBeUndefined();
  });

  it('ignores blank known keys', () => {
    expect(resolveCiJobKey(external, '900', ['', 'api'])).toBe('api');
    expect(resolveCiJobKey(external, '900', [''])).toBeUndefined();
  });

  it('answers the same for repeated known keys', () => {
    expect(resolveCiJobKey(external, '900', ['api', 'api'])).toBe('api');
  });
});
