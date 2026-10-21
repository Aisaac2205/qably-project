import type { CodeLanguage } from '../lib/highlight';

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface SubheadingBlock {
  type: 'subheading';
  text: string;
}

export interface ListBlock {
  type: 'list';
  ordered?: boolean;
  items: string[];
}

export interface CodeBlock {
  type: 'code';
  language: CodeLanguage;
  code: string;
  label?: string;
}

export interface CodeGroupVariant {
  language: CodeLanguage;
  label: string;
  code: string;
}

export interface CodeGroupBlock {
  type: 'codeGroup';
  label: string;
  variants: CodeGroupVariant[];
}

export interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface CalloutBlock {
  type: 'callout';
  tone: 'info' | 'warning';
  text: string;
}

export interface LogoRowItem {
  src: string;
  alt: string;
  label: string;
}

export interface LogoRowBlock {
  type: 'logoRow';
  items: LogoRowItem[];
}

export type FaqAnswerBlock = ParagraphBlock | ListBlock | CodeBlock;

export interface FaqBlock {
  type: 'faq';
  items: {
    question: string;
    answer: FaqAnswerBlock[];
  }[];
}

export type DocBlock =
  | ParagraphBlock
  | SubheadingBlock
  | ListBlock
  | CodeBlock
  | CodeGroupBlock
  | TableBlock
  | CalloutBlock
  | LogoRowBlock
  | FaqBlock;

export const API_BASE_URL_TOKEN = '{{API_BASE_URL}}';

/**
 * A section is an H2 inside its page and an entry of the page's "on this page"
 * table of contents. Its `id` is the public anchor, so it never changes once a
 * page is published (legacy deep links depend on it).
 */
export interface DocSection {
  id: string;
  navLabel: string;
  title: string;
  blocks: DocBlock[];
}

/**
 * One documentation page. The `slug` is a stable English slug shared by every
 * locale: `/docs/<slug>` in Spanish and `/en/docs/<slug>` in English. The page
 * whose slug is OVERVIEW_SLUG is served at `/docs` and `/en/docs`.
 */
export interface DocPage {
  slug: string;
  /** Short label for the sidebar and the previous/next links. */
  navLabel: string;
  /** The page's single h1 and the base of its <title>. */
  title: string;
  /** One plain sentence (at most 160 characters) used as meta description and lead. */
  description: string;
  sections: DocSection[];
}

export interface DocNavGroup {
  label: string;
  pageSlugs: string[];
}

/**
 * UI strings of the reader that belong to no page: the lead-in of each kind of
 * callout, and so on. Both locales define every key (content.test.ts).
 */
export interface DocLabels {
  /** Bold lead-in of an informational callout ("Note"). */
  calloutInfo: string;
  /** Bold lead-in of a warning callout ("Important"). */
  calloutWarning: string;
}

export interface DocContent {
  /** Root of the breadcrumb ("Docs") and name of the documentation. */
  docsLabel: string;
  breadcrumbAriaLabel: string;
  /** Accessible name of the left navigation landmark. */
  navAriaLabel: string;
  /** Label of the disclosure that holds the navigation below the lg breakpoint. */
  menuLabel: string;
  /** Title of the right-hand table of contents ("On this page"). */
  tocLabel: string;
  pagerAriaLabel: string;
  previousLabel: string;
  nextLabel: string;
  copyCodeLabel: string;
  copiedLabel: string;
  labels: DocLabels;
  navGroups: DocNavGroup[];
  pages: DocPage[];
}
