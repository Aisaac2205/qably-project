export function hasConfirmFlag(argv: readonly string[]): boolean {
  return argv.includes('--confirm');
}

export function hostOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return '(unparseable URL)';
  }
}

export function extractSuiteIds(
  rows: readonly { suiteId: string | null }[],
): string[] {
  return rows
    .map((row) => row.suiteId)
    .filter((suiteId): suiteId is string => suiteId !== null);
}
