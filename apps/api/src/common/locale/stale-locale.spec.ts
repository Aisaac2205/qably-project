import { isLocaleStale, staleLocaleWhere } from './stale-locale';

describe('isLocaleStale', () => {
  it('is never stale when the case has no documented steps yet', () => {
    expect(isLocaleStale({ steps: [], documentedLocale: null }, 'en')).toBe(
      false,
    );
  });

  it('is stale when the documented locale is null, regardless of who is asking', () => {
    expect(
      isLocaleStale({ steps: ['Open the cart'], documentedLocale: null }, 'en'),
    ).toBe(true);
  });

  it('is stale when the documented locale is undefined', () => {
    expect(
      isLocaleStale(
        { steps: ['Open the cart'], documentedLocale: undefined },
        'en',
      ),
    ).toBe(true);
  });

  it('is stale when the documented locale differs from the org default locale', () => {
    expect(
      isLocaleStale({ steps: ['Open the cart'], documentedLocale: 'es' }, 'en'),
    ).toBe(true);
  });

  it('is not stale when the documented locale matches the org default locale', () => {
    expect(
      isLocaleStale({ steps: ['Open the cart'], documentedLocale: 'en' }, 'en'),
    ).toBe(false);
  });

  it('ignores any notion of a viewer locale - only the org default locale matters', () => {
    const stale = isLocaleStale(
      { steps: ['Open the cart'], documentedLocale: 'en' },
      'en',
    );

    expect(stale).toBe(false);
  });
});

describe('staleLocaleWhere', () => {
  it('builds a Prisma filter matching documented cases whose locale is null or not the org default', () => {
    expect(staleLocaleWhere('en')).toEqual({
      NOT: { steps: { equals: [] } },
      OR: [
        { currentVersion: null },
        { currentVersion: { locale: null } },
        { currentVersion: { locale: { not: 'en' } } },
      ],
    });
  });
});
