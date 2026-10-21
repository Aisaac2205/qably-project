import { describe, expect, it } from 'vitest';
import { en } from './en';
import { es } from './es';
import type { DocContent } from './types';

const locales: [string, DocContent][] = [
  ['en', en],
  ['es', es],
];

function pageText(content: DocContent, slug: string): string {
  const page = content.pages.find((candidate) => candidate.slug === slug);
  if (page === undefined) throw new Error(`missing docs page: ${slug}`);
  return JSON.stringify(page);
}

describe.each(locales)('docs content (%s): commit attribution', (_locale, content) => {
  it('sends commitSha from every CI upload of the quickstart', () => {
    const text = pageText(content, 'quickstart');
    const uploads = text.match(/runs\/ingest\/junit\?externalId=/g) ?? [];
    const withCommit = text.match(/runs\/ingest\/junit\?externalId=[^"]*commitSha=/g) ?? [];

    expect(uploads.length).toBeGreaterThan(0);
    expect(withCommit.length).toBe(uploads.length);
  });

  it('uses the pull request head commit, not the temporary merge commit', () => {
    const text = pageText(content, 'quickstart');

    expect(text).toContain('github.event.pull_request.head.sha || github.sha');
  });

  it('links the quickstart to the regression guide', () => {
    expect(pageText(content, 'quickstart')).toContain('(/docs/regressions)');
  });

  it('says the case regressed notification comes from a manual run', () => {
    const text = pageText(content, 'notifications');
    const row = text.match(/\["(?:Case regressed|Caso con regresión)","[^\]]*\]/)?.[0] ?? '';

    expect(row).toMatch(/manual/i);
  });
});
