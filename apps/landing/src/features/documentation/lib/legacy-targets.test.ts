import { describe, expect, it } from 'vitest';
import { en } from '../content/en';
import { es } from '../content/es';
import {
  LEGACY_SECTION_TARGETS,
  resolveLegacyRedirect,
  type LegacySectionId,
} from './legacy-targets';

// The 15 section ids of the single-page docs that shipped before the split.
// Links to them are in the wild (apps/web, the footer, bookmarks), so none may
// be forgotten; when a page is removed, repoint its entry instead.
const OLD_SECTION_IDS = [
  'getting-started',
  'step-1-create-project',
  'step-2-connect-repository',
  'step-3-api-key',
  'step-4-report-ci',
  'step-5-verify',
  'other-languages',
  'naming-tests',
  'reference-runs-ingest',
  'reference-runs-ingest-junit',
  'reference-webhook',
  'reference-api-keys',
  'reference-env-vars',
  'notifications-discord-slack',
  'faq',
] as const;

const locales = [
  { name: 'es', content: es },
  { name: 'en', content: en },
] as const;

function noElement(): boolean {
  return false;
}

describe('LEGACY_SECTION_TARGETS', () => {
  it('covers exactly the 15 old section ids, once each', () => {
    expect(Object.keys(LEGACY_SECTION_TARGETS).sort()).toEqual([...OLD_SECTION_IDS].sort());
  });

  it.each(locales)('points every old id at a page and a section that exist in $name', ({ content }) => {
    for (const oldId of OLD_SECTION_IDS) {
      const target = LEGACY_SECTION_TARGETS[oldId as LegacySectionId];
      const targetPage = content.pages.find((candidate) => candidate.slug === target.slug);

      expect(targetPage, `page "${target.slug}" for "${oldId}"`).toBeDefined();
      expect(
        targetPage!.sections.some((candidate) => candidate.id === target.sectionId),
        `section "${target.sectionId}" in page "${target.slug}" for "${oldId}"`,
      ).toBe(true);
    }
  });

  it('keeps the old id as the new section id, so a hash keeps pointing at the same text', () => {
    for (const oldId of OLD_SECTION_IDS) {
      expect(LEGACY_SECTION_TARGETS[oldId as LegacySectionId].sectionId).toBe(oldId);
    }
  });

  it('sends the five setup steps to the quickstart', () => {
    const steps = OLD_SECTION_IDS.filter((id) => id.startsWith('step-'));

    expect(steps).toHaveLength(5);
    for (const id of steps) {
      expect(LEGACY_SECTION_TARGETS[id as LegacySectionId].slug).toBe('quickstart');
    }
  });

  it('sends the links the footer and the web app used to the pages that now hold them', () => {
    expect(LEGACY_SECTION_TARGETS['step-4-report-ci']).toEqual({
      slug: 'quickstart',
      sectionId: 'step-4-report-ci',
    });
    expect(LEGACY_SECTION_TARGETS['reference-api-keys']).toEqual({
      slug: 'api-keys',
      sectionId: 'reference-api-keys',
    });
  });
});

describe('resolveLegacyRedirect', () => {
  const base = { currentSlug: 'overview', hasElementWithId: noElement } as const;

  it('redirects an old step id to the quickstart of the current locale, keeping the hash', () => {
    expect(resolveLegacyRedirect({ ...base, hash: '#step-4-report-ci', locale: 'es' })).toBe(
      '/docs/quickstart#step-4-report-ci',
    );
    expect(resolveLegacyRedirect({ ...base, hash: '#step-4-report-ci', locale: 'en' })).toBe(
      '/en/docs/quickstart#step-4-report-ci',
    );
  });

  it('redirects an old reference id to its own page', () => {
    expect(resolveLegacyRedirect({ ...base, hash: '#reference-api-keys', locale: 'es' })).toBe(
      '/docs/api-keys#reference-api-keys',
    );
    expect(resolveLegacyRedirect({ ...base, hash: '#reference-runs-ingest-junit', locale: 'en' })).toBe(
      '/en/docs/api-ingest-junit#reference-runs-ingest-junit',
    );
  });

  it('redirects every old id except the one whose section still lives on the overview', () => {
    for (const oldId of OLD_SECTION_IDS) {
      const redirect = resolveLegacyRedirect({ ...base, hash: `#${oldId}`, locale: 'es' });

      if (oldId === 'getting-started') {
        expect(redirect, oldId).toBeNull();
      } else {
        expect(redirect, oldId).toMatch(new RegExp(`^/docs/[a-z0-9-]+#${oldId}$`));
      }
    }
  });

  it('stays put when the id still exists on the page', () => {
    expect(
      resolveLegacyRedirect({
        ...base,
        hash: '#getting-started',
        locale: 'es',
        hasElementWithId: (id) => id === 'getting-started',
      }),
    ).toBeNull();
  });

  it('stays put when the target is the page itself', () => {
    expect(
      resolveLegacyRedirect({ hash: '#getting-started', locale: 'es', currentSlug: 'overview', hasElementWithId: noElement }),
    ).toBeNull();
  });

  it('ignores an empty hash, a bare #, and an id that was never a docs section', () => {
    expect(resolveLegacyRedirect({ ...base, hash: '', locale: 'es' })).toBeNull();
    expect(resolveLegacyRedirect({ ...base, hash: '#', locale: 'es' })).toBeNull();
    expect(resolveLegacyRedirect({ ...base, hash: '#pricing', locale: 'es' })).toBeNull();
  });

  it('never throws on a malformed percent escape', () => {
    expect(resolveLegacyRedirect({ ...base, hash: '#%E0%A4%A', locale: 'es' })).toBeNull();
  });

  it('does not treat inherited object keys as old ids', () => {
    expect(resolveLegacyRedirect({ ...base, hash: '#constructor', locale: 'es' })).toBeNull();
    expect(resolveLegacyRedirect({ ...base, hash: '#__proto__', locale: 'es' })).toBeNull();
  });
});
