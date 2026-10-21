import type { DocPage } from '../types';
import { caseHealth } from './case-health';
import { regressions } from './regressions';
import type { GuidePair } from './types';
import { whatToTest } from './what-to-test';
import { writeACase } from './write-a-case';

/**
 * Best-practice guides, in registry order. The order of the sidebar is set by
 * `navGroups` in en.ts and es.ts (group "Best practices" / "Buenas prácticas").
 */
export const GUIDES: readonly GuidePair[] = [writeACase, whatToTest, caseHealth, regressions];

export function guidePages(locale: 'es' | 'en'): DocPage[] {
  return GUIDES.map((guide) => guide[locale]);
}
