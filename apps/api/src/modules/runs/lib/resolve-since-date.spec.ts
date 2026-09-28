import { resolveSinceDate } from './resolve-since-date';

describe('resolveSinceDate', () => {
  it('subtracts exactly the given number of days from now', () => {
    const now = new Date('2026-06-16T12:00:00.000Z');

    expect(resolveSinceDate(now, 30).toISOString()).toBe(
      '2026-05-17T12:00:00.000Z',
    );
  });

  it('returns a strictly earlier instant for a one-day window', () => {
    const now = new Date('2026-06-16T00:00:00.000Z');

    expect(resolveSinceDate(now, 1).getTime()).toBeLessThan(now.getTime());
  });
});
