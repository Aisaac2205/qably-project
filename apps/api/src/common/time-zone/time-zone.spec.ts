import {
  DEFAULT_TIME_ZONE,
  MAX_TIME_ZONE_LENGTH,
  isValidIanaTimeZone,
  resolveTimeZone,
  startOfZonedDay,
  tzOffsetMinutes,
  zonedDateKey,
} from './time-zone';

describe('isValidIanaTimeZone', () => {
  it('accepts a real IANA zone name', () => {
    expect(isValidIanaTimeZone('America/Guatemala')).toBe(true);
  });

  it('accepts UTC', () => {
    expect(isValidIanaTimeZone('UTC')).toBe(true);
  });

  it('rejects a malformed zone name', () => {
    expect(isValidIanaTimeZone('Not/AZone')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidIanaTimeZone('')).toBe(false);
  });
});

describe('resolveTimeZone', () => {
  it('falls back to UTC when the value is missing', () => {
    expect(resolveTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
  });

  it('resolves a valid zone as-is', () => {
    expect(resolveTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
  });

  it('returns null for a malformed zone', () => {
    expect(resolveTimeZone('Not/AZone')).toBeNull();
  });

  it('returns null when the value exceeds the max length', () => {
    const tooLong = `America/${'A'.repeat(MAX_TIME_ZONE_LENGTH)}`;

    expect(tooLong.length).toBeGreaterThan(MAX_TIME_ZONE_LENGTH);
    expect(resolveTimeZone(tooLong)).toBeNull();
  });

  it('pins the max length at 64 characters', () => {
    expect(MAX_TIME_ZONE_LENGTH).toBe(64);
  });
});

describe('tzOffsetMinutes', () => {
  it('reports Guatemala as six hours behind UTC', () => {
    const instant = new Date('2026-06-16T20:00:00.000Z');

    expect(tzOffsetMinutes(instant, 'America/Guatemala')).toBe(-360);
  });

  it('reports Tokyo as nine hours ahead of UTC', () => {
    const instant = new Date('2026-06-16T20:00:00.000Z');

    expect(tzOffsetMinutes(instant, 'Asia/Tokyo')).toBe(540);
  });

  it('reports zero offset for UTC itself', () => {
    const instant = new Date('2026-06-16T20:00:00.000Z');

    expect(tzOffsetMinutes(instant, 'UTC')).toBe(0);
  });
});

describe('zonedDateKey', () => {
  it('formats an instant as the calendar day it falls on in the zone', () => {
    const instant = new Date('2026-06-16T20:00:00.000Z');

    expect(zonedDateKey(instant, 'America/Guatemala')).toBe('2026-06-16');
    expect(zonedDateKey(instant, 'UTC')).toBe('2026-06-16');
  });

  it('rolls a late UTC evening into the next local day for a positive offset', () => {
    const instant = new Date('2026-06-16T20:00:00.000Z');

    expect(zonedDateKey(instant, 'Asia/Tokyo')).toBe('2026-06-17');
  });

  it('keeps an early UTC morning on the previous local day for a negative offset', () => {
    const instant = new Date('2026-06-17T02:00:00.000Z');

    expect(zonedDateKey(instant, 'America/Guatemala')).toBe('2026-06-16');
  });
});

describe('startOfZonedDay', () => {
  it('returns the UTC instant of local midnight for a negative-offset zone', () => {
    const start = startOfZonedDay(2026, 6, 16, 'America/Guatemala');

    expect(start.toISOString()).toBe('2026-06-16T06:00:00.000Z');
  });

  it('returns the UTC instant of local midnight for a positive-offset zone', () => {
    const start = startOfZonedDay(2026, 6, 16, 'Asia/Tokyo');

    expect(start.toISOString()).toBe('2026-06-15T15:00:00.000Z');
  });

  it('returns the same instant as the naive date for UTC', () => {
    const start = startOfZonedDay(2026, 6, 16, 'UTC');

    expect(start.toISOString()).toBe('2026-06-16T00:00:00.000Z');
  });
});
