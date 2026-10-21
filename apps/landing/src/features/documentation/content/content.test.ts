import { describe, expect, it } from 'vitest';
import { stripInline } from '../lib/inline';
import { getAllSections } from '../lib/pages';
import { en } from './en';
import { es } from './es';
import type { CodeGroupBlock, DocBlock, DocContent } from './types';

const locales: { name: string; content: DocContent }[] = [
  { name: 'en', content: en },
  { name: 'es', content: es },
];

// Prose goes through the inline renderer, so the words are compared without the
// markers (`**bold**`, `code`, links); code blocks stay exactly as written.
function collectBlockText(block: DocBlock, parts: string[]): void {
  switch (block.type) {
    case 'paragraph':
    case 'subheading':
    case 'callout':
      parts.push(stripInline(block.text));
      break;
    case 'list':
      parts.push(...block.items.map(stripInline));
      break;
    case 'code':
      parts.push(block.code);
      break;
    case 'codeGroup':
      parts.push(block.label);
      for (const variant of block.variants) parts.push(variant.label, variant.code);
      break;
    case 'table':
      parts.push(...block.headers.map(stripInline));
      for (const row of block.rows) parts.push(...row.map(stripInline));
      break;
    case 'logoRow':
      for (const item of block.items) parts.push(item.alt, item.label);
      break;
    case 'faq':
      for (const item of block.items) {
        parts.push(stripInline(item.question));
        for (const answerBlock of item.answer) collectBlockText(answerBlock, parts);
      }
      break;
  }
}

function collectCodeGroups(block: DocBlock, groups: CodeGroupBlock[]): void {
  if (block.type === 'codeGroup') groups.push(block);
  if (block.type === 'faq') {
    for (const item of block.items) {
      for (const answerBlock of item.answer) collectCodeGroups(answerBlock, groups);
    }
  }
}

function collectAllCodeGroups(content: DocContent): CodeGroupBlock[] {
  const groups: CodeGroupBlock[] = [];

  for (const section of getAllSections(content)) {
    for (const block of section.blocks) collectCodeGroups(block, groups);
  }

  return groups;
}

// Every text the reader can see, on every page: the page chrome, the nav, each
// page's metadata and every block of every section.
function flattenContent(content: DocContent): string {
  const parts: string[] = [
    content.docsLabel,
    content.breadcrumbAriaLabel,
    content.navAriaLabel,
    content.menuLabel,
    content.tocLabel,
    content.pagerAriaLabel,
    content.previousLabel,
    content.nextLabel,
    content.copyCodeLabel,
    content.copiedLabel,
    ...Object.values(content.labels),
  ];

  for (const group of content.navGroups) parts.push(group.label);

  for (const page of content.pages) {
    parts.push(page.navLabel, page.title, page.description);

    for (const section of page.sections) {
      parts.push(section.navLabel, section.title);
      for (const block of section.blocks) collectBlockText(block, parts);
    }
  }

  return parts.join('\n');
}

// Technology names and monorepo paths that must never leak into public docs —
// public documentation describes the API contract, never the implementation.
// (jest-junit, Vitest, pytest, PHPUnit, Maven, Gradle, and similar are the
// reader's own tooling and are intentionally not in this list.)
const FORBIDDEN_STACK_TERMS = [
  'NestJS',
  'Express',
  'PostgreSQL',
  'Prisma',
  'Redis',
  'BullMQ',
  'Next.js',
  'Astro',
  'Turborepo',
  'better-auth',
  'Better Auth',
  'pnpm',
];

const FORBIDDEN_PATHS = ['apps/api', 'apps/web', 'apps/landing', 'packages/'];

// Rioplatense voseo verb forms that must never appear in the (neutral, tú/impersonal)
// Spanish documentation. Matched with an accent-aware boundary since JS's default
// \w does not treat accented vowels as word characters.
const VOSEO_MARKERS = [
  'vos',
  'podés',
  'tenés',
  'querés',
  'debés',
  'necesitás',
  'hacé',
  'configurá',
  'configuralo',
  'verificá',
  'creá',
  'usá',
  'usala',
  'abrí',
  'copiá',
  'copialo',
  'pegá',
  'seguí',
  'revisá',
  'elegí',
  'guardalo',
  'guárdalo',
  'obtené',
  'llamá',
  'agregá',
  'confirmá',
  'buscá',
  'generá',
  'apuntá',
  'apuntalo',
  'dejá',
  'enviá',
  'mirá',
  'iniciá',
  'registrá',
  'rotás',
];

const SPANISH_LETTER = 'a-zA-ZáéíóúÁÉÍÓÚñÑ';

function findAccentAwareMatch(haystack: string, word: string): string | undefined {
  const pattern = new RegExp(`(?<![${SPANISH_LETTER}])${word}(?![${SPANISH_LETTER}])`, 'i');
  const match = haystack.match(pattern);
  return match?.[0];
}

function findAsciiWordMatch(haystack: string, word: string): string | undefined {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
  const match = haystack.match(pattern);
  return match?.[0];
}

const MAX_DESCRIPTION_LENGTH = 160;

describe('documentation content', () => {
  it.each(locales)('$name has a non-empty UI label for every kind of callout', ({ content }) => {
    expect(content.labels.calloutInfo.trim().length).toBeGreaterThan(0);
    expect(content.labels.calloutWarning.trim().length).toBeGreaterThan(0);
    expect(content.labels.calloutInfo).not.toBe(content.labels.calloutWarning);
  });

  it('en and es define the same UI labels, and translate them', () => {
    expect(Object.keys(es.labels).sort()).toEqual(Object.keys(en.labels).sort());

    for (const key of Object.keys(en.labels) as (keyof typeof en.labels)[]) {
      expect(es.labels[key], `es label "${key}"`).not.toBe(en.labels[key]);
    }
  });

  it.each(locales)('$name has at least one page', ({ content }) => {
    expect(content.pages.length).toBeGreaterThan(0);
  });

  it.each(locales)('$name has no duplicated page slug', ({ content }) => {
    const slugs = content.pages.map((page) => page.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(locales)('$name page slugs are lowercase english slugs', ({ content }) => {
    for (const page of content.pages) {
      expect(page.slug, `slug "${page.slug}"`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it.each(locales)('$name has an overview page for /docs', ({ content }) => {
    expect(content.pages.some((page) => page.slug === 'overview')).toBe(true);
  });

  it.each(locales)('$name every nav group slug resolves to a real page', ({ content }) => {
    const slugs = new Set(content.pages.map((page) => page.slug));
    const navSlugs = content.navGroups.flatMap((group) => group.pageSlugs);

    expect(navSlugs.length).toBeGreaterThan(0);

    for (const slug of navSlugs) {
      expect(slugs.has(slug), `nav slug "${slug}"`).toBe(true);
    }
  });

  it.each(locales)('$name puts every page in exactly one nav group', ({ content }) => {
    const navSlugs = content.navGroups.flatMap((group) => group.pageSlugs);

    expect(new Set(navSlugs).size).toBe(navSlugs.length);
    expect([...navSlugs].sort()).toEqual(content.pages.map((page) => page.slug).sort());
  });

  it.each(locales)('$name has no empty nav group', ({ content }) => {
    for (const group of content.navGroups) {
      expect(group.label.length).toBeGreaterThan(0);
      expect(group.pageSlugs.length).toBeGreaterThan(0);
    }
  });

  it.each(locales)('$name has no duplicated section id anywhere in the docs', ({ content }) => {
    const ids = getAllSections(content).map((section) => section.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('en and es expose the same page slugs, in the same order', () => {
    expect(es.pages.map((page) => page.slug)).toEqual(en.pages.map((page) => page.slug));
  });

  it('en and es expose the same section ids in every page, in the same order', () => {
    for (const enPage of en.pages) {
      const esPage = es.pages.find((candidate) => candidate.slug === enPage.slug);

      expect(esPage, `es page "${enPage.slug}"`).toBeDefined();
      expect(esPage!.sections.map((section) => section.id)).toEqual(
        enPage.sections.map((section) => section.id),
      );
    }
  });

  it('en and es nav groups reference the same page slugs, in the same order', () => {
    const enNav = en.navGroups.map((group) => group.pageSlugs);
    const esNav = es.navGroups.map((group) => group.pageSlugs);

    expect(esNav).toEqual(enNav);
  });

  it('en and es nav groups have the same number of groups', () => {
    expect(es.navGroups.length).toBe(en.navGroups.length);
  });

  it.each(locales)('$name pages and sections all carry non-empty content', ({ content }) => {
    for (const page of content.pages) {
      expect(page.navLabel.length, `navLabel of "${page.slug}"`).toBeGreaterThan(0);
      expect(page.title.length, `title of "${page.slug}"`).toBeGreaterThan(0);
      expect(page.sections.length, `sections of "${page.slug}"`).toBeGreaterThan(0);

      for (const section of page.sections) {
        expect(section.id.length).toBeGreaterThan(0);
        expect(section.navLabel.length).toBeGreaterThan(0);
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.blocks.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(locales)(
    '$name page descriptions are one plain sentence of at most 160 characters',
    ({ content }) => {
      for (const page of content.pages) {
        expect(page.description.length, `description of "${page.slug}"`).toBeGreaterThan(0);
        expect(page.description.length, `description of "${page.slug}"`).toBeLessThanOrEqual(
          MAX_DESCRIPTION_LENGTH,
        );
        expect(page.description, `description of "${page.slug}"`).not.toMatch(/\n/);
      }
    },
  );

  it.each(locales)('$name page descriptions are unique', ({ content }) => {
    const descriptions = content.pages.map((page) => page.description);

    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it.each(locales)('$name page titles and nav labels are unique', ({ content }) => {
    const titles = content.pages.map((page) => page.title);
    const labels = content.pages.map((page) => page.navLabel);

    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it.each(locales)(
    '$name never names an internal technology or monorepo path',
    ({ content }) => {
      const text = flattenContent(content);

      for (const term of FORBIDDEN_STACK_TERMS) {
        const match = findAsciiWordMatch(text, term);
        expect(match, `found forbidden stack term "${term}"`).toBeUndefined();
      }

      for (const path of FORBIDDEN_PATHS) {
        expect(text.includes(path), `found forbidden path "${path}"`).toBe(false);
      }
    },
  );

  it('es never uses Rioplatense voseo', () => {
    const text = flattenContent(es);

    for (const marker of VOSEO_MARKERS) {
      const match = findAccentAwareMatch(text, marker);
      expect(match, `found voseo marker "${marker}"`).toBeUndefined();
    }
  });

  it.each(locales)('$name has at least one codeGroup block', ({ content }) => {
    expect(collectAllCodeGroups(content).length).toBeGreaterThan(0);
  });

  it.each(locales)('$name codeGroup blocks each have at least two variants', ({ content }) => {
    for (const group of collectAllCodeGroups(content)) {
      expect(group.variants.length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(locales)('$name codeGroup blocks never repeat a variant label', ({ content }) => {
    for (const group of collectAllCodeGroups(content)) {
      const labels = group.variants.map((variant) => variant.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it.each(locales)(
    '$name other-languages section never stacks a standalone code block directly after a framework subheading',
    ({ content }) => {
      const section = getAllSections(content).find((candidate) => candidate.id === 'other-languages');
      expect(section).toBeDefined();

      const blocks = section!.blocks;
      for (let i = 0; i < blocks.length - 1; i += 1) {
        const current = blocks[i];
        const next = blocks[i + 1];
        const isSubheadingFollowedByCode = current.type === 'subheading' && next.type === 'code';
        expect(
          isSubheadingFollowedByCode,
          `subheading "${current.type === 'subheading' ? current.text : ''}" is directly followed by a standalone code block`,
        ).toBe(false);
      }
    },
  );
});
