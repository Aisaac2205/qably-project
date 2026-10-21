import type { DocPage } from '../types';

/**
 * One best-practice guide in both locales. Each guide lives in its own file so
 * guides can be written independently; `index.ts` is the only registry.
 * Both pages share the same slug, section ids, subheading count and block order
 * (content.test.ts enforces parity).
 */
export interface GuidePair {
  es: DocPage;
  en: DocPage;
}
