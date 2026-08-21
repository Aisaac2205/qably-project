import { toSlug, withSlugSuffix } from './slug';

describe('toSlug', () => {
  it('lowercases and joins words with a hyphen', () => {
    expect(toSlug('Acme QA Team')).toBe('acme-qa-team');
  });

  it('strips accents so the slug stays url safe', () => {
    expect(toSlug('Organización Ñandú')).toBe('organizacion-nandu');
  });

  it('collapses punctuation and repeated separators', () => {
    expect(toSlug('  Ada   &&  Co.  ')).toBe('ada-co');
  });

  it('drops leading and trailing hyphens', () => {
    expect(toSlug('---Acme---')).toBe('acme');
  });

  it('falls back when the name has nothing sluggable', () => {
    expect(toSlug('***')).toBe('workspace');
    expect(toSlug('')).toBe('workspace');
  });

  it('caps the length so it cannot grow unbounded', () => {
    expect(toSlug('a'.repeat(120)).length).toBeLessThanOrEqual(48);
  });

  it('never ends on a hyphen after being capped', () => {
    expect(toSlug(`${'a'.repeat(47)} tail`)).not.toMatch(/-$/);
  });
});

describe('withSlugSuffix', () => {
  it('returns the base slug on the first attempt', () => {
    expect(withSlugSuffix('acme', 0)).toBe('acme');
  });

  it('appends a distinct suffix on later attempts', () => {
    const second = withSlugSuffix('acme', 1);
    const third = withSlugSuffix('acme', 2);

    expect(second).toMatch(/^acme-[0-9a-z]+$/);
    expect(third).toMatch(/^acme-[0-9a-z]+$/);
    expect(second).not.toBe(third);
  });

  it('keeps the suffixed slug within the length cap', () => {
    expect(withSlugSuffix('a'.repeat(48), 3).length).toBeLessThanOrEqual(48);
  });
});
