const FIXED_BUCKET_MARKER = "AT TIME ZONE 'UTC') AT TIME ZONE";

function tzOffsetMinutes(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );

  return (asUtc - instant.getTime()) / 60000;
}

function correctZonedDayKey(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function buggyZonedDayKey(instant: Date, zone: string): string {
  const offset = tzOffsetMinutes(instant, zone);
  const shifted = new Date(instant.getTime() - offset * 60000);

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}

export interface StageCountsSqlFragment {
  readonly strings: readonly string[];
}

export interface RunSeedRow {
  readonly startedAt: Date;
}

export function emulateRunsStageCountsFromCapturedSql(
  sql: StageCountsSqlFragment,
  zone: string,
  year: number,
  rows: readonly RunSeedRow[],
): { day: string; count: number }[] {
  const statement = sql.strings.join(' ');

  if (!statement.includes('"run" r')) return [];

  const bucket = statement.includes(FIXED_BUCKET_MARKER)
    ? correctZonedDayKey
    : buggyZonedDayKey;

  const counts = new Map<string, number>();

  for (const row of rows) {
    const day = bucket(row.startedAt, zone);

    if (!day.startsWith(`${year}-`)) continue;

    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  return [...counts.entries()].map(([day, count]) => ({ day, count }));
}
