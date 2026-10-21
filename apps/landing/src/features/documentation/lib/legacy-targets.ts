import type { Locale } from '../../i18n/types';
import { docsPagePath } from './pages';

/**
 * Before the docs were split in pages, every section was an anchor of one long
 * page (the step-4-report-ci section of the docs root, for example). Those
 * links are in the wild: the web app, the footer and any bookmark. A fragment never reaches a server, so it cannot
 * be redirected there; the overview page runs `resolveLegacyRedirect` in the
 * browser instead and moves the reader to the page that now holds the section.
 *
 * Every section kept its id as the id of its new h2, so the hash survives.
 */
export interface LegacyTarget {
  slug: string;
  sectionId: string;
}

const LEGACY_SECTION_IDS = [
  'getting-started',
  'step-1-create-project',
  'step-2-connect-repository',
  'step-3-api-key',
  'step-4-report-ci',
  'step-5-verify',
  'other-languages',
  'naming-tests',
  'reference-runs-ingest',
  'reference-runs-ingest-junit',
  'reference-webhook',
  'reference-api-keys',
  'reference-env-vars',
  'notifications-discord-slack',
  'faq',
] as const;

export type LegacySectionId = (typeof LEGACY_SECTION_IDS)[number];

export const LEGACY_SECTION_TARGETS: Readonly<Record<LegacySectionId, LegacyTarget>> = {
  'getting-started': { slug: 'overview', sectionId: 'getting-started' },
  'step-1-create-project': { slug: 'quickstart', sectionId: 'step-1-create-project' },
  'step-2-connect-repository': { slug: 'quickstart', sectionId: 'step-2-connect-repository' },
  'step-3-api-key': { slug: 'quickstart', sectionId: 'step-3-api-key' },
  'step-4-report-ci': { slug: 'quickstart', sectionId: 'step-4-report-ci' },
  'step-5-verify': { slug: 'quickstart', sectionId: 'step-5-verify' },
  'other-languages': { slug: 'other-runners', sectionId: 'other-languages' },
  'naming-tests': { slug: 'naming-tests', sectionId: 'naming-tests' },
  'reference-runs-ingest': { slug: 'api-ingest', sectionId: 'reference-runs-ingest' },
  'reference-runs-ingest-junit': { slug: 'api-ingest-junit', sectionId: 'reference-runs-ingest-junit' },
  'reference-webhook': { slug: 'api-webhooks', sectionId: 'reference-webhook' },
  'reference-api-keys': { slug: 'api-keys', sectionId: 'reference-api-keys' },
  'reference-env-vars': { slug: 'env-vars', sectionId: 'reference-env-vars' },
  'notifications-discord-slack': { slug: 'notifications', sectionId: 'notifications-discord-slack' },
  faq: { slug: 'faq', sectionId: 'faq' },
};

function isLegacySectionId(id: string): id is LegacySectionId {
  return (LEGACY_SECTION_IDS as readonly string[]).includes(id);
}

export interface LegacyRedirectInput {
  /** `location.hash`, with its leading "#". */
  hash: string;
  locale: Locale;
  /** Slug of the page the reader is on. */
  currentSlug: string;
  /** True when the current document already has an element with that id. */
  hasElementWithId: (id: string) => boolean;
}

/**
 * The URL to move to when `hash` is a section id of the old single page that no
 * longer lives where the reader is, or null to stay. Never throws: a malformed
 * hash simply is not a legacy link.
 */
export function resolveLegacyRedirect(input: LegacyRedirectInput): string | null {
  const { hash, locale, currentSlug, hasElementWithId } = input;

  if (hash.length < 2 || hash[0] !== '#') return null;

  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }

  if (!isLegacySectionId(id)) return null;
  if (hasElementWithId(id)) return null;

  const target = LEGACY_SECTION_TARGETS[id];

  if (target.slug === currentSlug) return null;

  return `${docsPagePath(locale, target.slug)}#${target.sectionId}`;
}
