const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

export function assertLocalBenchUrl(rawUrl: string): void {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`BENCH_DATABASE_URL is not a valid URL: "${rawUrl}"`);
  }

  if (!LOCAL_HOSTNAMES.has(parsed.hostname)) {
    throw new Error(
      `Refusing to run the review inbox bench against "${parsed.hostname}". ` +
        'BENCH_DATABASE_URL must point at localhost or 127.0.0.1 — the shared Railway database is forbidden.',
    );
  }
}
