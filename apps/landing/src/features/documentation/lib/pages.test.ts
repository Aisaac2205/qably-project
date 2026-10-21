import { describe, expect, it } from 'vitest';
import { en } from '../content/en';
import { es } from '../content/es';
import type { DocContent, DocPage, DocSection } from '../content/types';
import {
  OVERVIEW_SLUG,
  docsBasePath,
  docsPagePath,
  findPage,
  getAllSections,
  getDocsStaticPaths,
  getOrderedPages,
  getPageGroup,
  getPrevNext,
  getSubheadingLevel,
  isSectionHeadingVisible,
} from './pages';

function section(id: string, title = id): DocSection {
  return { id, navLabel: title, title, blocks: [{ type: 'paragraph', text: id }] };
}

function page(slug: string, sections: DocSection[], title = slug): DocPage {
  return { slug, navLabel: title, title, description: `About ${slug}.`, sections };
}

// Group order is the reading order, and it is not the order of `pages`.
const fixture: DocContent = {
  docsLabel: 'Docs',
  breadcrumbAriaLabel: 'Breadcrumb',
  navAriaLabel: 'Navigation',
  menuLabel: 'Menu',
  tocLabel: 'On this page',
  pagerAriaLabel: 'Pager',
  previousLabel: 'Previous',
  nextLabel: 'Next',
  copyCodeLabel: 'Copy',
  copiedLabel: 'Copied',
  labels: en.labels,
  navGroups: [
    { label: 'Start', pageSlugs: ['overview', 'setup'] },
    { label: 'Reference', pageSlugs: ['api'] },
  ],
  pages: [
    page('api', [section('api-a')]),
    page('overview', [section('intro')]),
    page('setup', [section('step-1'), section('step-2')]),
  ],
};

describe('docs paths', () => {
  it('serves the overview at the docs root of each locale', () => {
    expect(OVERVIEW_SLUG).toBe('overview');
    expect(docsBasePath('es')).toBe('/docs');
    expect(docsBasePath('en')).toBe('/en/docs');
    expect(docsPagePath('es', 'overview')).toBe('/docs');
    expect(docsPagePath('en', 'overview')).toBe('/en/docs');
  });

  it('serves every other page below the docs root of each locale', () => {
    expect(docsPagePath('es', 'quickstart')).toBe('/docs/quickstart');
    expect(docsPagePath('en', 'quickstart')).toBe('/en/docs/quickstart');
    expect(docsPagePath('es', 'api-ingest-junit')).toBe('/docs/api-ingest-junit');
    expect(docsPagePath('en', 'api-ingest-junit')).toBe('/en/docs/api-ingest-junit');
  });
});

describe('docs page lookup', () => {
  it('lists every section of every page, in page order', () => {
    expect(getAllSections(fixture).map((candidate) => candidate.id)).toEqual([
      'api-a',
      'intro',
      'step-1',
      'step-2',
    ]);
  });

  it('finds a page by slug and returns undefined for an unknown one', () => {
    expect(findPage(fixture, 'setup')?.title).toBe('setup');
    expect(findPage(fixture, 'nope')).toBeUndefined();
  });

  it('orders the pages as the nav groups read, not as the pages are declared', () => {
    expect(getOrderedPages(fixture).map((candidate) => candidate.slug)).toEqual([
      'overview',
      'setup',
      'api',
    ]);
  });

  it('finds the nav group that holds a page', () => {
    expect(getPageGroup(fixture, 'setup')?.label).toBe('Start');
    expect(getPageGroup(fixture, 'api')?.label).toBe('Reference');
    expect(getPageGroup(fixture, 'nope')).toBeUndefined();
  });
});

describe('previous and next pages', () => {
  it('has no previous page on the first page', () => {
    const { previous, next } = getPrevNext(fixture, 'es', 'overview');

    expect(previous).toBeNull();
    expect(next).toEqual({ slug: 'setup', navLabel: 'setup', path: '/docs/setup' });
  });

  it('crosses a group boundary and keeps the locale in the paths', () => {
    const { previous, next } = getPrevNext(fixture, 'en', 'setup');

    expect(previous).toEqual({ slug: 'overview', navLabel: 'overview', path: '/en/docs' });
    expect(next).toEqual({ slug: 'api', navLabel: 'api', path: '/en/docs/api' });
  });

  it('has no next page on the last page', () => {
    const { previous, next } = getPrevNext(fixture, 'es', 'api');

    expect(previous?.slug).toBe('setup');
    expect(next).toBeNull();
  });

  it('has neither for an unknown slug', () => {
    expect(getPrevNext(fixture, 'es', 'nope')).toEqual({ previous: null, next: null });
  });

  it.each([
    { name: 'es', content: es },
    { name: 'en', content: en },
  ])('chains every $name page into one reading order', ({ name, content }) => {
    const locale = name as 'es' | 'en';
    const ordered = getOrderedPages(content);

    expect(ordered).toHaveLength(content.pages.length);

    ordered.forEach((current, index) => {
      const { previous, next } = getPrevNext(content, locale, current.slug);

      expect(previous?.slug ?? null).toBe(ordered[index - 1]?.slug ?? null);
      expect(next?.slug ?? null).toBe(ordered[index + 1]?.slug ?? null);
    });
  });
});

describe('static paths', () => {
  it('maps the overview to the root and every other page to its slug', () => {
    expect(getDocsStaticPaths(fixture)).toEqual([
      { params: { slug: 'api' }, props: { slug: 'api' } },
      { params: { slug: undefined }, props: { slug: 'overview' } },
      { params: { slug: 'setup' }, props: { slug: 'setup' } },
    ]);
  });

  it.each([
    { name: 'es', content: es },
    { name: 'en', content: en },
  ])('builds one route per $name page, with a single root route', ({ content }) => {
    const paths = getDocsStaticPaths(content);

    expect(paths).toHaveLength(content.pages.length);
    expect(paths.filter((path) => path.params.slug === undefined)).toHaveLength(1);
    expect(new Set(paths.map((path) => path.params.slug)).size).toBe(paths.length);
  });
});

describe('section headings', () => {
  it('hides the heading of a lone section that repeats the page title', () => {
    const alone = page('faq', [section('faq', 'FAQ')], 'FAQ');

    expect(isSectionHeadingVisible(alone, alone.sections[0]!)).toBe(false);
  });

  it('shows the heading of a lone section that says something else', () => {
    const alone = page('overview', [section('getting-started', 'Getting started')], 'Documentation');

    expect(isSectionHeadingVisible(alone, alone.sections[0]!)).toBe(true);
  });

  it('shows every heading of a page with several sections', () => {
    const several = page('setup', [section('step-1', 'setup'), section('step-2')], 'setup');

    expect(isSectionHeadingVisible(several, several.sections[0]!)).toBe(true);
    expect(isSectionHeadingVisible(several, several.sections[1]!)).toBe(true);
  });

  it('renders subheadings as h3 under a visible section heading and as h2 when that heading is hidden', () => {
    const alone = page('faq', [section('faq', 'FAQ')], 'FAQ');
    const several = page('setup', [section('step-1'), section('step-2')]);

    expect(getSubheadingLevel(alone, alone.sections[0]!)).toBe(2);
    expect(getSubheadingLevel(several, several.sections[0]!)).toBe(3);
  });

  it.each([
    { name: 'es', content: es },
    { name: 'en', content: en },
  ])('never drops a section title that differs from its page title ($name)', ({ content }) => {
    for (const current of content.pages) {
      for (const candidate of current.sections) {
        if (!isSectionHeadingVisible(current, candidate)) {
          expect(candidate.title, `page "${current.slug}"`).toBe(current.title);
        }
      }
    }
  });
});
