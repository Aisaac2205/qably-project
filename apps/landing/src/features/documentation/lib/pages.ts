import type { Locale } from '../../i18n/types';
import type { DocContent, DocNavGroup, DocPage, DocSection } from '../content/types';

/** The page served at the docs root: `/docs` and `/en/docs`. */
export const OVERVIEW_SLUG = 'overview';

export function docsBasePath(locale: Locale): string {
  return locale === 'en' ? '/en/docs' : '/docs';
}

/** Public path of a page: the overview owns the docs root, the rest sit below it. */
export function docsPagePath(locale: Locale, slug: string): string {
  const base = docsBasePath(locale);

  return slug === OVERVIEW_SLUG ? base : `${base}/${slug}`;
}

export function getAllSections(content: DocContent): DocSection[] {
  return content.pages.flatMap((page) => page.sections);
}

export function findPage(content: DocContent, slug: string): DocPage | undefined {
  return content.pages.find((page) => page.slug === slug);
}

/** Pages in reading order: group by group, as the sidebar lists them. */
export function getOrderedPages(content: DocContent): DocPage[] {
  return content.navGroups.flatMap((group) =>
    group.pageSlugs.flatMap((slug) => {
      const page = findPage(content, slug);

      return page === undefined ? [] : [page];
    }),
  );
}

export function getPageGroup(content: DocContent, slug: string): DocNavGroup | undefined {
  return content.navGroups.find((group) => group.pageSlugs.includes(slug));
}

export interface PageLink {
  slug: string;
  navLabel: string;
  path: string;
}

function toPageLink(locale: Locale, page: DocPage): PageLink {
  return { slug: page.slug, navLabel: page.navLabel, path: docsPagePath(locale, page.slug) };
}

export function getPrevNext(
  content: DocContent,
  locale: Locale,
  slug: string,
): { previous: PageLink | null; next: PageLink | null } {
  const ordered = getOrderedPages(content);
  const index = ordered.findIndex((page) => page.slug === slug);

  if (index === -1) return { previous: null, next: null };

  const previous = ordered[index - 1];
  const next = ordered[index + 1];

  return {
    previous: previous === undefined ? null : toPageLink(locale, previous),
    next: next === undefined ? null : toPageLink(locale, next),
  };
}

/**
 * The shape Astro's `getStaticPaths` expects for the `[...slug]` route: the
 * overview has no slug param (it is the docs root), every other page has its own.
 */
export function getDocsStaticPaths(
  content: DocContent,
): { params: { slug: string | undefined }; props: { slug: string } }[] {
  return content.pages.map((page) => ({
    params: { slug: page.slug === OVERVIEW_SLUG ? undefined : page.slug },
    props: { slug: page.slug },
  }));
}

/**
 * A page made of one section that repeats the page title shows the title once,
 * as the h1: a second, identical h2 right under it would only add noise. A lone
 * section that says something else keeps its heading, so no text is ever dropped.
 */
export function isSectionHeadingVisible(page: DocPage, section: DocSection): boolean {
  return !(page.sections.length === 1 && section.title === page.title);
}

/**
 * Heading level of a section's subheadings. Under a visible section heading they
 * are h3; when that heading is not rendered they follow the page's h1 directly,
 * so they are h2 and the outline never skips a level.
 */
export function getSubheadingLevel(page: DocPage, section: DocSection): 2 | 3 {
  return isSectionHeadingVisible(page, section) ? 3 : 2;
}
