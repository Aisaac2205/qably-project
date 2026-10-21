import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { en } from '../content/en';
import { es } from '../content/es';
import type { DocContent } from '../content/types';
import { findBrokenInlineLinks } from './link-targets';
import { docsPagePath } from './pages';
import { buildPageToc } from './toc';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(here, '../../..');

/**
 * Every internal link to the documentation that is written as a string literal
 * anywhere in the landing source: `"/docs"`, `'/en/docs/quickstart#step-4-report-ci'`.
 * Links built from a variable (`${homeHref}#features`) are not documentation links.
 */
const DOCS_HREF_LITERAL = /(["'`])((?:\/en)?\/docs(?:\/[A-Za-z0-9._~-]*)*(?:#[A-Za-z0-9_-]*)?)\1/g;

const SOURCE_EXTENSIONS = new Set(['.astro', '.tsx', '.ts']);

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') files.push(...listSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith('.test.ts')) {
      files.push(full);
    }
  }

  return files;
}

interface DocsHref {
  file: string;
  href: string;
}

function findDocsHrefs(): DocsHref[] {
  const found: DocsHref[] = [];

  for (const file of listSourceFiles(SRC_ROOT)) {
    const source = readFileSync(file, 'utf-8');
    const relative = path.relative(SRC_ROOT, file).split(path.sep).join('/');

    for (const match of source.matchAll(DOCS_HREF_LITERAL)) {
      found.push({ file: relative, href: match[2]! });
    }
  }

  return found;
}

/** Route table built from the page model: every path and the anchors it holds. */
function buildRouteTable(): Map<string, Set<string>> {
  const table = new Map<string, Set<string>>();
  const locales: { locale: 'es' | 'en'; content: DocContent }[] = [
    { locale: 'es', content: es },
    { locale: 'en', content: en },
  ];

  for (const { locale, content } of locales) {
    for (const page of content.pages) {
      const anchors = new Set<string>([
        ...page.sections.map((section) => section.id),
        ...buildPageToc(page).map((entry) => entry.id),
      ]);

      table.set(docsPagePath(locale, page.slug), anchors);
    }
  }

  return table;
}

function resolveHref(href: string, table: Map<string, Set<string>>): string | null {
  const hashIndex = href.indexOf('#');
  const route = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? null : href.slice(hashIndex + 1);
  const anchors = table.get(route);

  if (anchors === undefined) return `no docs page is served at "${route}"`;
  if (fragment === null) return null;
  if (fragment === '') return 'the fragment is empty';
  if (!anchors.has(fragment)) return `page "${route}" has no anchor "#${fragment}"`;

  return null;
}

describe('internal links to the documentation', () => {
  const table = buildRouteTable();
  const hrefs = findDocsHrefs();

  it('builds a route for every page in both locales', () => {
    expect(table.size).toBe(es.pages.length + en.pages.length);
    expect(table.has('/docs')).toBe(true);
    expect(table.has('/en/docs')).toBe(true);
    expect(table.has('/docs/quickstart')).toBe(true);
    expect(table.has('/en/docs/quickstart')).toBe(true);
  });

  it('finds the documentation links of the header, the footer, the CTA, the hero and the home section', () => {
    const files = new Set(hrefs.map((entry) => entry.file));

    expect(files).toContain('features/navigation/components/SiteHeader.astro');
    expect(files).toContain('features/navigation/components/Footer.astro');
    expect(files).toContain('features/navigation/components/CtaBanner.astro');
    expect(files).toContain('components/ui/saa-s-template.tsx');
    expect(files).toContain('features/documentation/components/DocumentationSection.tsx');
  });

  it('resolves every documentation link to an existing page and anchor', () => {
    const broken = hrefs.flatMap(({ file, href }) => {
      const problem = resolveHref(href, table);

      return problem === null ? [] : [`${file}: ${href} (${problem})`];
    });

    expect(broken).toEqual([]);
  });

  it('links the footer shortcuts to the pages that hold them now', () => {
    const footer = hrefs.filter((entry) => entry.file === 'features/navigation/components/Footer.astro');
    const targets = footer.map((entry) => entry.href);

    expect(targets).toContain('/docs/api-keys');
    expect(targets).toContain('/en/docs/api-keys');
    expect(targets).toContain('/docs/quickstart#step-4-report-ci');
    expect(targets).toContain('/en/docs/quickstart#step-4-report-ci');
    expect(targets.filter((href) => /^\/(?:en\/)?docs#/.test(href))).toEqual([]);
  });

  it('rejects the old single-page anchors, which only the legacy redirect still serves', () => {
    expect(resolveHref('/docs#step-4-report-ci', table)).not.toBeNull();
    expect(resolveHref('/en/docs#reference-api-keys', table)).not.toBeNull();
    expect(resolveHref('/docs/quickstart#step-4-report-ci', table)).toBeNull();
    expect(resolveHref('/docs/nope', table)).not.toBeNull();
    expect(resolveHref('/docs/', table)).not.toBeNull();
  });
});

describe('links written as inline markup in the docs content', () => {
  it.each([
    { name: 'es', content: es },
    { name: 'en', content: en },
  ])('every [label](/docs/...) in the $name content resolves to a page and an anchor', ({ content }) => {
    expect(findBrokenInlineLinks(content)).toEqual([]);
  });

  it('would catch a broken link written in markup', () => {
    const broken: DocContent = {
      ...en,
      pages: en.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              sections: page.sections.map((section, sectionIndex) =>
                sectionIndex === 0
                  ? {
                      ...section,
                      blocks: [
                        ...section.blocks,
                        { type: 'paragraph' as const, text: 'See [nowhere](/docs/not-a-page) or [there](/docs/quickstart#nope).' },
                      ],
                    }
                  : section,
              ),
            }
          : page,
      ),
    };

    expect(findBrokenInlineLinks(broken)).toHaveLength(2);
  });
});
