import type { Locale } from '../../i18n/types';
import type { DocContent } from '../content/types';
import { forEachProse } from './content-walk';
import { inspectInline, type InlineHref } from './inline';
import { OVERVIEW_SLUG, docsPagePath } from './pages';
import { buildPageToc } from './toc';

/** Page slug to the anchors the page really has: its sections and its subheadings. */
export type LinkTargets = ReadonlyMap<string, ReadonlySet<string>>;

export function buildLinkTargets(content: DocContent): LinkTargets {
  const targets = new Map<string, Set<string>>();

  for (const page of content.pages) {
    targets.set(
      page.slug,
      new Set([...page.sections.map((section) => section.id), ...buildPageToc(page).map((entry) => entry.id)]),
    );
  }

  return targets;
}

/** Why a docs link does not resolve; null when it does. */
function explainDocsLink(targets: LinkTargets, href: Extract<InlineHref, { kind: 'docs' }>): string | null {
  const slug = href.slug ?? OVERVIEW_SLUG;
  const anchors = targets.get(slug);

  if (anchors === undefined) return `no docs page "${slug}"`;
  if (href.anchor !== null && !anchors.has(href.anchor)) return `page "${slug}" has no anchor "#${href.anchor}"`;

  return null;
}

/**
 * Public path of a docs link in the given locale, or null when the page or the
 * anchor does not exist (the renderer then shows the label as plain text).
 */
export function resolveDocsLink(targets: LinkTargets, locale: Locale, href: InlineHref): string | null {
  if (href.kind !== 'docs' || explainDocsLink(targets, href) !== null) return null;

  const path = docsPagePath(locale, href.slug ?? OVERVIEW_SLUG);

  return href.anchor === null ? path : `${path}#${href.anchor}`;
}

/** Writes a docs link as authors do, for messages. */
function docsTarget(href: Extract<InlineHref, { kind: 'docs' }>): string {
  const base = href.slug === null ? '/docs' : `/docs/${href.slug}`;

  return href.anchor === null ? base : `${base}#${href.anchor}`;
}

/**
 * Every link written as inline markup that would not render as a link: a docs
 * link to a page or an anchor that does not exist, and a target the grammar
 * rejects (which would otherwise silently become plain text).
 */
export function findBrokenInlineLinks(content: DocContent): string[] {
  const targets = buildLinkTargets(content);
  const broken: string[] = [];

  forEachProse(content, (text, where) => {
    const { nodes, rejectedTargets } = inspectInline(text);

    for (const target of rejectedTargets) broken.push(`${target} (${where}): not an allowed link target`);

    const pending = [...nodes];

    for (let node = pending.shift(); node !== undefined; node = pending.shift()) {
      if (node.type === 'strong' || node.type === 'link') pending.unshift(...node.children);
      if (node.type !== 'link' || node.href.kind !== 'docs') continue;

      const problem = explainDocsLink(targets, node.href);

      if (problem !== null) broken.push(`${docsTarget(node.href)} (${where}): ${problem}`);
    }
  });

  return broken;
}
