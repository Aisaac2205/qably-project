import type { DocPage } from '../content/types';
import { getSubheadingLevel, isSectionHeadingVisible } from './pages';

export interface TocEntry {
  id: string;
  label: string;
  /** The level of the heading it points to: h2 for a section, h3 for a subheading inside one. */
  level: 2 | 3;
}

/** Below this many entries a contents list adds nothing the page does not already show. */
export const MIN_TOC_ENTRIES = 2;

export function hasPageToc(entries: readonly TocEntry[]): boolean {
  return entries.length >= MIN_TOC_ENTRIES;
}

export function slugifyHeading(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug === '' ? 'section' : slug;
}

/**
 * Stable anchor of a subheading: the id of its section plus the slug of its
 * text. The article and the table of contents both derive it from here, so they
 * can never disagree.
 */
export function subheadingId(sectionId: string, text: string): string {
  return `${sectionId}-${slugifyHeading(text)}`;
}

export function buildPageToc(page: DocPage): TocEntry[] {
  const entries: TocEntry[] = [];

  for (const section of page.sections) {
    if (isSectionHeadingVisible(page, section)) {
      entries.push({ id: section.id, label: section.title, level: 2 });
    }

    const level = getSubheadingLevel(page, section);

    for (const block of section.blocks) {
      if (block.type === 'subheading') {
        entries.push({ id: subheadingId(section.id, block.text), label: block.text, level });
      }
    }
  }

  return entries;
}

export interface TocTarget {
  id: string;
  /** Distance in pixels between the top of the viewport and the top of the target. */
  top: number;
}

/**
 * The target the reader is in: the last one whose top has reached the offset
 * (a pixel of rounding is tolerated), or the last one at all once the page is
 * scrolled to the bottom, where a short final section could never reach it.
 * `targets` must be in document order.
 */
export function pickActiveTocId(
  targets: readonly TocTarget[],
  offset: number,
  atBottom: boolean,
): string | null {
  const first = targets[0];

  if (first === undefined) return null;
  if (atBottom) return targets[targets.length - 1]!.id;

  let current = first;
  for (const target of targets) {
    if (target.top - offset > 1) break;
    current = target;
  }

  return current.id;
}
