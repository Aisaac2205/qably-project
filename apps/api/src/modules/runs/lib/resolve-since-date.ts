const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function resolveSinceDate(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_IN_MS);
}
