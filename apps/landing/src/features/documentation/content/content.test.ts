import { describe, expect, it } from 'vitest';
import { en } from './en';
import { es } from './es';
import type { DocContent } from './types';

const locales: { name: string; content: DocContent }[] = [
  { name: 'en', content: en },
  { name: 'es', content: es },
];

describe('documentation content', () => {
  it.each(locales)(
    'every sidebar anchor in $name resolves to a real section id',
    ({ content }) => {
      const sectionIds = new Set(content.sections.map((section) => section.id));
      const anchorIds = content.navGroups.flatMap((group) => group.sectionIds);

      expect(anchorIds.length).toBeGreaterThan(0);

      for (const id of anchorIds) {
        expect(sectionIds.has(id)).toBe(true);
      }
    },
  );

  it.each(locales)('$name has no duplicated section id', ({ content }) => {
    const ids = content.sections.map((section) => section.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(locales)('$name has no duplicated anchor within a nav group', ({ content }) => {
    for (const group of content.navGroups) {
      expect(new Set(group.sectionIds).size).toBe(group.sectionIds.length);
    }
  });

  it('en and es expose the same section ids, in the same order', () => {
    const enIds = en.sections.map((section) => section.id);
    const esIds = es.sections.map((section) => section.id);

    expect(esIds).toEqual(enIds);
  });

  it('en and es nav groups reference the same section ids, in the same order', () => {
    const enNav = en.navGroups.flatMap((group) => group.sectionIds);
    const esNav = es.navGroups.flatMap((group) => group.sectionIds);

    expect(esNav).toEqual(enNav);
  });

  it('en and es nav groups have the same number of groups', () => {
    expect(es.navGroups.length).toBe(en.navGroups.length);
  });

  it.each(locales)('$name sections all carry non-empty content', ({ content }) => {
    for (const section of content.sections) {
      expect(section.id.length).toBeGreaterThan(0);
      expect(section.navLabel.length).toBeGreaterThan(0);
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.blocks.length).toBeGreaterThan(0);
    }
  });
});
