import { normalizeAutomationFilePath } from './normalize-automation-file-path';

describe('normalizeAutomationFilePath', () => {
  it('strips the GitHub Actions runner absolute prefix from the reported bug', () => {
    expect(
      normalizeAutomationFilePath(
        '/home/runner/work/qably-project/qably-project/apps/web/src/features/dashboard/test/pass-rate-hero.test.tsx',
      ),
    ).toBe('apps/web/src/features/dashboard/test/pass-rate-hero.test.tsx');
  });

  it('strips a Windows GitHub Actions runner absolute prefix and normalizes separators', () => {
    expect(
      normalizeAutomationFilePath(
        'D:\\a\\qably-project\\qably-project\\apps\\web\\src\\file.test.ts',
      ),
    ).toBe('apps/web/src/file.test.ts');
  });

  it('strips the Bitbucket Pipelines absolute prefix', () => {
    expect(
      normalizeAutomationFilePath(
        '/opt/atlassian/pipelines/agent/build/apps/api/src/file.spec.ts',
      ),
    ).toBe('apps/api/src/file.spec.ts');
  });

  it('strips a GitLab CI builds absolute prefix', () => {
    expect(
      normalizeAutomationFilePath(
        '/builds/acme/qably-project/apps/api/src/file.spec.ts',
      ),
    ).toBe('apps/api/src/file.spec.ts');
  });

  it('leaves an already repo-relative path unchanged', () => {
    expect(normalizeAutomationFilePath('apps/web/src/file.test.ts')).toBe(
      'apps/web/src/file.test.ts',
    );
  });

  it('trims surrounding whitespace on an already relative path', () => {
    expect(normalizeAutomationFilePath('  apps/web/file.ts  ')).toBe(
      'apps/web/file.ts',
    );
  });

  it('returns an empty string unchanged', () => {
    expect(normalizeAutomationFilePath('')).toBe('');
  });

  it('never touches a relative path that merely mentions a CI directory name', () => {
    expect(normalizeAutomationFilePath('home/runner/work/file.ts')).toBe(
      'home/runner/work/file.ts',
    );
  });

  it('uses the known connection repo name to strip a non-standard absolute CI prefix', () => {
    expect(
      normalizeAutomationFilePath(
        '/custom-ci/workspace/qably-project/apps/api/file.ts',
        'qably-project',
      ),
    ).toBe('apps/api/file.ts');
  });

  it('uses the repo name to recover from a GitHub prefix missing its duplicated segment', () => {
    expect(
      normalizeAutomationFilePath(
        '/home/runner/work/qably-project/apps/file.ts',
        'qably-project',
      ),
    ).toBe('apps/file.ts');
  });

  it('prefers the fixed CI-root pattern over the repo name when both would match', () => {
    expect(
      normalizeAutomationFilePath(
        '/home/runner/work/qably-project/qably-project/apps/file.ts',
        'qably-project',
      ),
    ).toBe('apps/file.ts');
  });

  it('leaves an unrecognized absolute path unchanged when no repo name is known', () => {
    expect(normalizeAutomationFilePath('/random/absolute/path/file.ts')).toBe(
      '/random/absolute/path/file.ts',
    );
  });

  it('leaves an absolute path unchanged when the repo name only matches the final segment', () => {
    expect(
      normalizeAutomationFilePath(
        '/builds/acme/qably-project',
        'qably-project',
      ),
    ).toBe('/builds/acme/qably-project');
  });

  it('ignores a blank repo name and falls back to the fixed patterns', () => {
    expect(
      normalizeAutomationFilePath(
        '/opt/atlassian/pipelines/agent/build/apps/file.ts',
        '   ',
      ),
    ).toBe('apps/file.ts');
  });
});
