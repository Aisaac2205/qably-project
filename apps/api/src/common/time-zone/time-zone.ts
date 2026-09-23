export const DEFAULT_TIME_ZONE = 'UTC';
export const MAX_TIME_ZONE_LENGTH = 64;

export function isValidIanaTimeZone(value: string): boolean {
  if (value.length === 0 || value.length > MAX_TIME_ZONE_LENGTH) return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function canonicalizeTimeZone(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: value,
  }).resolvedOptions().timeZone;
}

export function resolveTimeZone(value: string | undefined): string | null {
  if (value === undefined) return DEFAULT_TIME_ZONE;
  if (value.length > MAX_TIME_ZONE_LENGTH) return null;

  return isValidIanaTimeZone(value) ? canonicalizeTimeZone(value) : null;
}

export function tzOffsetMinutes(instant: Date, zone: string): number {
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

export function zonedDateKey(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function startOfZonedDay(
  year: number,
  month: number,
  day: number,
  zone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = tzOffsetMinutes(new Date(guess), zone);

  return new Date(guess - offset * 60000);
}
