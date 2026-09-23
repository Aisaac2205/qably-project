export interface DecidedCaseCounts {
  pass: number;
  fail: number;
  blocked: number;
}

export function countDecided(counts: DecidedCaseCounts): number {
  return counts.pass + counts.fail + counts.blocked;
}

export function computePassRate(counts: DecidedCaseCounts): number | null {
  const decided = countDecided(counts);
  return decided === 0 ? null : counts.pass / decided;
}

export function computePassRateTrend(
  current: number | null,
  previous: number | null,
): number | null {
  return current === null || previous === null ? null : current - previous;
}
