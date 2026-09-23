import { z } from 'zod';
import { DEFAULT_TIME_ZONE } from './time-zone';
import { timeZoneQuerySchema } from './time-zone-query.schema';

describe('timeZoneQuerySchema', () => {
  it('falls back to UTC when tz is missing', () => {
    const result = timeZoneQuerySchema.safeParse(undefined);

    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe(DEFAULT_TIME_ZONE);
  });

  it('resolves a valid IANA zone', () => {
    const result = timeZoneQuerySchema.safeParse('America/Guatemala');

    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe('America/Guatemala');
  });

  it('rejects a malformed zone with a 400-worthy error', () => {
    const result = timeZoneQuerySchema.safeParse('Not/AZone');

    expect(result.success).toBe(false);
  });

  it('composes into an object schema as an optional query param', () => {
    const objectSchema = z.object({ tz: timeZoneQuerySchema });

    expect(objectSchema.safeParse({}).success).toBe(true);
    expect(objectSchema.safeParse({ tz: 'Not/AZone' }).success).toBe(false);
    const parsed = objectSchema.safeParse({ tz: 'Asia/Tokyo' });
    expect(parsed.success && parsed.data.tz).toBe('Asia/Tokyo');
  });
});
