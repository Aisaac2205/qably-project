import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REPORTER_PATH = join(__dirname, 'qably-report.mjs');
export const REPORTER_MODULE_URL = pathToFileURL(REPORTER_PATH).href;

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export function runNodeEval(script: string): RunResult {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    {
      encoding: 'utf8',
    },
  );

  if (result.error) throw result.error;

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.status,
  };
}

export function callPure<T>(calls: Array<{ fn: string; args: unknown[] }>): T {
  const invocations = calls
    .map(
      (call, index) =>
        `results[${index}] = await mod.${call.fn}(...${JSON.stringify(call.args)});`,
    )
    .join('\n');

  const script = `
    const mod = await import(${JSON.stringify(REPORTER_MODULE_URL)});
    const results = [];
    ${invocations}
    process.stdout.write(JSON.stringify(results));
  `;

  const result = runNodeEval(script);

  if (result.exitCode !== 0) {
    throw new Error(`harness script failed: ${result.stderr}`);
  }

  return JSON.parse(result.stdout) as T;
}

export function runCli(
  args: string[],
  env: Record<string, string | undefined>,
  cwd?: string,
): Promise<RunResult> {
  const merged: Record<string, string> = {
    ...(process.env as Record<string, string>),
  };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [REPORTER_PATH, ...args], {
      env: merged,
      cwd,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });
  });
}
