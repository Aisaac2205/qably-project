import { describe, expect, it } from 'vitest';
import { forEachProse, walkBlocks } from '../lib/content-walk';
import { validateDiagram } from '../lib/diagram';
import { collectInlineLinks, parseInline, stripInline, type InlineNode } from '../lib/inline';
import { getAllSections } from '../lib/pages';
import { buildPageToc, hasPageToc } from '../lib/toc';
import { en } from './en';
import { es } from './es';
import type { CodeGroupBlock, DiagramBlock, DocBlock, DocContent } from './types';

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
    case 'diagram':
      parts.push(block.title, block.description);
      if (block.caption !== undefined) parts.push(stripInline(block.caption));
      for (const group of block.groups ?? []) parts.push(group.label);
      for (const node of block.nodes) {
        parts.push(node.label);
        if (node.detail !== undefined) parts.push(stripInline(node.detail));
      }
      for (const edge of block.edges ?? []) {
        if (edge.label !== undefined) parts.push(edge.label);
      }
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

function collectDiagrams(content: DocContent): { where: string; diagram: DiagramBlock }[] {
  return [...walkBlocks(content)].flatMap(({ block, where }) =>
    block.type === 'diagram' ? [{ where, diagram: block }] : [],
  );
}

describe('documentation diagrams', () => {
  it.each(locales)('$name every diagram is well formed: known ids, a linear flow, contiguous lanes', ({ content }) => {
    for (const { where, diagram } of collectDiagrams(content)) {
      expect(validateDiagram(diagram), `diagram at ${where}`).toEqual([]);
    }
  });

  it.each(locales)('$name every edge and node group points to a node or group that exists', ({ content }) => {
    for (const { where, diagram } of collectDiagrams(content)) {
      const nodeIds = new Set(diagram.nodes.map((node) => node.id));
      const groupIds = new Set((diagram.groups ?? []).map((group) => group.id));

      for (const edge of diagram.edges ?? []) {
        expect(nodeIds.has(edge.from), `${where}: edge from "${edge.from}"`).toBe(true);
        expect(nodeIds.has(edge.to), `${where}: edge to "${edge.to}"`).toBe(true);
      }

      for (const node of diagram.nodes) {
        if (node.group !== undefined) expect(groupIds.has(node.group), `${where}: group "${node.group}"`).toBe(true);
      }
    }
  });

  it.each(locales)('$name every diagram has a title and a text alternative', ({ content }) => {
    for (const { where, diagram } of collectDiagrams(content)) {
      expect(diagram.title.trim().length, `title at ${where}`).toBeGreaterThan(0);
      expect(diagram.description.trim().length, `description at ${where}`).toBeGreaterThan(0);
    }
  });

  it('en and es draw the same diagrams: same places, same nodes, same lanes, same edges', () => {
    const shape = (diagram: DiagramBlock) => ({
      nodes: diagram.nodes.map((node) => [node.id, node.group ?? null]),
      groups: (diagram.groups ?? []).map((group) => [group.id, group.tone ?? 'external']),
      edges: (diagram.edges ?? []).map((edge) => [edge.from, edge.to]),
    });
    const enDiagrams = collectDiagrams(en);
    const esDiagrams = collectDiagrams(es);

    expect(esDiagrams.map((entry) => entry.where)).toEqual(enDiagrams.map((entry) => entry.where));

    for (const [index, entry] of enDiagrams.entries()) {
      expect(shape(esDiagrams[index]!.diagram), `diagram at ${entry.where}`).toEqual(shape(entry.diagram));
    }
  });
});

describe('documentation content', () => {
  it.each(locales)('$name has a non-empty UI label for every kind of callout', ({ content }) => {
    expect(content.labels.calloutInfo.trim().length).toBeGreaterThan(0);
    expect(content.labels.calloutWarning.trim().length).toBeGreaterThan(0);
    expect(content.labels.calloutInfo).not.toBe(content.labels.calloutWarning);
  });

  it.each(locales)('$name has every UI label non-empty', ({ content }) => {
    for (const [key, value] of Object.entries(content.labels)) {
      expect(value.trim().length, `label "${key}"`).toBeGreaterThan(0);
    }
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

// ---------------------------------------------------------------------------
// How the text is written: markup, callouts and code
// ---------------------------------------------------------------------------

/** Every prose string, keyed by where it lives, so two locales can be compared place by place. */
function proseByPath(content: DocContent): Map<string, string> {
  const seen = new Map<string, number>();
  const prose = new Map<string, string>();

  forEachProse(content, (text, where) => {
    const index = seen.get(where) ?? 0;

    seen.set(where, index + 1);
    prose.set(`${where} #${index}`, text);
  });

  return prose;
}

function collectStrong(nodes: readonly InlineNode[], spans: string[]): void {
  for (const node of nodes) {
    if (node.type === 'strong') spans.push(stripInline(node.children.map(nodeText).join('')));
    if (node.type === 'link') collectStrong(node.children, spans);
  }
}

function nodeText(node: InlineNode): string {
  if (node.type === 'text' || node.type === 'code') return node.value;

  return node.children.map(nodeText).join('');
}

function strongSpans(text: string): string[] {
  const spans: string[] = [];

  collectStrong(parseInline(text), spans);

  return spans;
}

/** The words of a string that are not inside a code span. */
function textOutsideCode(text: string): string {
  const parts: string[] = [];
  const visit = (nodes: readonly InlineNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'text') parts.push(node.value);
      if (node.type === 'strong' || node.type === 'link') visit(node.children);
    }
  };

  visit(parseInline(text));

  return parts.join('');
}

function linkTargets(text: string): string[] {
  return collectInlineLinks(text).map((href) => {
    if (href.kind === 'external') return href.url;

    const base = href.slug === null ? '/docs' : `/docs/${href.slug}`;

    return href.anchor === null ? base : `${base}#${href.anchor}`;
  });
}

function linkTargetsOfPage(content: DocContent, slug: string): string[] {
  const page = content.pages.find((candidate) => candidate.slug === slug);
  const targets: string[] = [];

  forEachProse({ ...content, pages: page === undefined ? [] : [page] }, (text) => targets.push(...linkTargets(text)));

  return targets;
}

function collectCodeStrings(content: DocContent): { where: string; label: string; code: string }[] {
  return [...walkBlocks(content)].flatMap(({ block, where }) => {
    if (block.type === 'code') return [{ where, label: 'code', code: block.code }];
    if (block.type === 'codeGroup') {
      return block.variants.map((variant) => ({ where, label: variant.label, code: variant.code }));
    }

    return [];
  });
}

// Identifiers a reader copies: they are code in the prose, never plain words.
const IDENTIFIERS_THAT_ARE_CODE: RegExp[] = [
  /\b(?:POST|GET) \//,
  /Authorization: Bearer/,
  /\b(?:externalId|suiteId|suiteName|commitSha|QABLY_API_KEY|QABLY_API_BASE_URL)\b/,
  /\bx-hub-signature-256\b/,
  /\bjunit\.xml\b/,
];

describe('documentation text style', () => {
  it.each(locales)('$name keeps a callout only as the exception: at most one per section', ({ content }) => {
    for (const page of content.pages) {
      for (const section of page.sections) {
        const callouts = section.blocks.filter((block) => block.type === 'callout');

        expect(callouts.length, `callouts in ${page.slug}#${section.id}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it.each(locales)('$name links the cross-references the page split had reworded as plain text', ({ content }) => {
    expect(linkTargetsOfPage(content, 'other-runners')).toContain('/docs/quickstart#step-4-report-ci');
    expect(linkTargetsOfPage(content, 'quickstart')).toContain('/docs/faq');
    expect(linkTargetsOfPage(content, 'faq')).toContain('/docs/quickstart#step-2-connect-repository');
  });

  it.each(locales)('$name links the pages a reference page or the overview sends the reader to', ({ content }) => {
    expect(linkTargetsOfPage(content, 'overview')).toEqual(
      expect.arrayContaining(['/docs/quickstart', '/docs/api-keys', '/docs/api-ingest', '/docs/api-webhooks']),
    );
    expect(linkTargetsOfPage(content, 'other-runners')).toContain('/docs/api-ingest-junit');
    expect(linkTargetsOfPage(content, 'api-ingest-junit')).toContain('/docs/api-ingest');
    expect(linkTargetsOfPage(content, 'api-webhooks')).toContain('/docs/quickstart#step-2-connect-repository');
    expect(linkTargetsOfPage(content, 'notifications')).toContain('/docs/api-webhooks');
  });

  it('en and es have the same prose in the same places, link the same targets and bold the same number of spans', () => {
    const enProse = proseByPath(en);
    const esProse = proseByPath(es);

    expect([...esProse.keys()]).toEqual([...enProse.keys()]);

    for (const [path, enText] of enProse) {
      const esText = esProse.get(path)!;

      expect(linkTargets(esText), `links at ${path}`).toEqual(linkTargets(enText));
      expect(strongSpans(esText).length, `bold spans at ${path}`).toBe(strongSpans(enText).length);
    }
  });

  it.each(locales)('$name uses bold for lead-ins and key terms: one or two spans, never a whole text or a heading', ({ content }) => {
    forEachProse(content, (text, where) => {
      const spans = strongSpans(text);

      expect(spans.length, `bold spans at ${where}`).toBeLessThanOrEqual(2);

      if (where.endsWith(' subheading') || where.endsWith(' table')) {
        expect(spans, `bold at ${where}`).toEqual([]);
      }

      for (const span of spans) {
        expect(span.length, `bold span "${span}" at ${where}`).toBeLessThan(stripInline(text).length);
      }
    });
  });

  it.each(locales)('$name writes endpoints, fields, headers and variables as code', ({ content }) => {
    forEachProse(content, (text, where) => {
      const outside = textOutsideCode(text);

      for (const identifier of IDENTIFIERS_THAT_ARE_CODE) {
        expect(outside, `${identifier} written as plain text at ${where}`).not.toMatch(identifier);
      }
    });
  });

  it.each(locales)('$name sets no code block with stray indentation', ({ content }) => {
    for (const { where, label, code } of collectCodeStrings(content)) {
      const lines = code.split('\n');
      const rest = lines.slice(1).filter((line) => line.trim() !== '');

      // A first line that is a complete statement is followed by statements at column 0.
      const continues = /[\\{([=]$/.test(lines[0]!.trimEnd());

      if (rest.length > 0 && !continues) {
        expect(
          rest.some((line) => !/^\s/.test(line)),
          `every line after the first is indented in "${label}" at ${where}`,
        ).toBe(true);
      }

      for (const line of rest) {
        if (line.trimStart().startsWith('#')) {
          expect(line, `comment line in "${label}" at ${where}`).toBe(line.trimStart());
        }
      }
    }
  });
});

describe('documentation structure', () => {
  it.each(locales)('$name gives every page a table of contents of at least two entries', ({ content }) => {
    for (const page of content.pages) {
      const entries = buildPageToc(page);

      expect(hasPageToc(entries), `"${page.slug}" has ${entries.length} table of contents entries`).toBe(true);
    }
  });

  it('en and es split every section into the same kinds of blocks, in the same order', () => {
    const shape = (content: DocContent) =>
      content.pages.map((page) => ({
        slug: page.slug,
        sections: page.sections.map((section) => ({
          id: section.id,
          blocks: section.blocks.map((block) =>
            block.type === 'faq' ? `faq:${block.items.map((item) => item.answer.length).join(',')}` : block.type,
          ),
        })),
      }));

    expect(shape(es)).toEqual(shape(en));
  });

  it.each(locales)('$name never titles a page or a section like the sidebar group that holds it', ({ content }) => {
    for (const group of content.navGroups) {
      for (const slug of group.pageSlugs) {
        const page = content.pages.find((candidate) => candidate.slug === slug)!;

        expect(page.title, `title of "${slug}"`).not.toBe(group.label);
        expect(page.navLabel, `nav label of "${slug}"`).not.toBe(group.label);

        for (const section of page.sections) {
          expect(section.title, `title of "${slug}#${section.id}"`).not.toBe(group.label);
          expect(section.navLabel, `nav label of "${slug}#${section.id}"`).not.toBe(group.label);
        }
      }
    }
  });

  it.each(locales)('$name keeps subheadings to words and code: no link inside a heading', ({ content }) => {
    forEachProse(content, (text, where) => {
      if (where.endsWith(' subheading')) expect(linkTargets(text), `links at ${where}`).toEqual([]);
    });
  });

  it.each(locales)('$name keeps the anchor of the overview section that old links point to', ({ content }) => {
    const overview = content.pages.find((page) => page.slug === 'overview')!;

    expect(overview.sections.map((section) => section.id)).toContain('getting-started');
  });
});
