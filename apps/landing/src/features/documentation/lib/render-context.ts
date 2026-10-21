import type { Locale } from '../../i18n/types';
import type { DocContent } from '../content/types';
import type { InlineHref } from './inline';
import { buildLinkTargets, resolveDocsLink } from './link-targets';

/**
 * What the block components need besides the blocks themselves: the locale, the
 * copy-button labels and the way to turn a docs link written in markup into the
 * path of the current locale. Built once per page and passed down.
 */
export interface DocsRenderContext {
  locale: Locale;
  copyLabel: string;
  copiedLabel: string;
  /** Public path of a docs link, or null when its page or anchor does not exist. */
  resolveLink: (href: InlineHref) => string | null;
}

export function createRenderContext(content: DocContent, locale: Locale): DocsRenderContext {
  const targets = buildLinkTargets(content);

  return {
    locale,
    copyLabel: content.copyCodeLabel,
    copiedLabel: content.copiedLabel,
    resolveLink: (href) => resolveDocsLink(targets, locale, href),
  };
}
