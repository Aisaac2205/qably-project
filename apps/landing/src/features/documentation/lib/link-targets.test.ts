import { describe, expect, it } from 'vitest';
import type { DocBlock, DocContent } from '../content/types';
import { buildLinkTargets, findBrokenInlineLinks, resolveDocsLink } from './link-targets';

function buildContent(extraBlocks: DocBlock[] = []): DocContent {
  return {
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
    navGroups: [{ label: 'Start', pageSlugs: ['overview', 'guide'] }],
    pages: [
      {
        slug: 'overview',
        navLabel: 'Overview',
        title: 'Overview',
        description: 'The overview.',
        sections: [
          { id: 'getting-started', navLabel: 'Start', title: 'Start', blocks: [{ type: 'paragraph', text: 'x' }] },
        ],
      },
      {
        slug: 'guide',
        navLabel: 'Guide',
        title: 'Guide',
        description: 'The guide.',
        sections: [
          {
            id: 'step-1',
            navLabel: 'Step 1',
            title: 'Step 1',
            blocks: [
              { type: 'paragraph', text: 'x' },
              { type: 'subheading', text: 'Pick `one`' },
              ...extraBlocks,
            ],
          },
          { id: 'step-2', navLabel: 'Step 2', title: 'Step 2', blocks: [{ type: 'paragraph', text: 'y' }] },
        ],
      },
    ],
  };
}

describe('resolveDocsLink', () => {
  const targets = buildLinkTargets(buildContent());

  it('localizes the path of a page', () => {
    expect(resolveDocsLink(targets, 'es', { kind: 'docs', slug: 'guide', anchor: null })).toBe('/docs/guide');
    expect(resolveDocsLink(targets, 'en', { kind: 'docs', slug: 'guide', anchor: null })).toBe('/en/docs/guide');
  });

  it('resolves the docs root to the overview', () => {
    expect(resolveDocsLink(targets, 'es', { kind: 'docs', slug: null, anchor: null })).toBe('/docs');
    expect(resolveDocsLink(targets, 'en', { kind: 'docs', slug: null, anchor: 'getting-started' })).toBe(
      '/en/docs#getting-started',
    );
  });

  it('keeps the anchor of a section', () => {
    expect(resolveDocsLink(targets, 'es', { kind: 'docs', slug: 'guide', anchor: 'step-2' })).toBe('/docs/guide#step-2');
  });

  it('accepts the anchor of a subheading, whose id comes from its text without markup', () => {
    expect(resolveDocsLink(targets, 'es', { kind: 'docs', slug: 'guide', anchor: 'step-1-pick-one' })).toBe(
      '/docs/guide#step-1-pick-one',
    );
  });

  it('returns null for an unknown page', () => {
    expect(resolveDocsLink(targets, 'es', { kind: 'docs', slug: 'nope', anchor: null })).toBeNull();
  });

  it('returns null for an anchor the page does not have, even if another page has it', () => {
    expect(resolveDocsLink(targets, 'es', { kind: 'docs', slug: 'guide', anchor: 'getting-started' })).toBeNull();
    expect(resolveDocsLink(targets, 'es', { kind: 'docs', slug: 'guide', anchor: 'nope' })).toBeNull();
  });

  it('does not resolve external links: they are not documentation targets', () => {
    expect(resolveDocsLink(targets, 'es', { kind: 'external', url: 'https://example.com' })).toBeNull();
  });
});

describe('findBrokenInlineLinks', () => {
  it('finds nothing when every docs link resolves', () => {
    const content = buildContent([
      { type: 'paragraph', text: 'See [the overview](/docs) and [step 2](/docs/guide#step-2).' },
      { type: 'paragraph', text: 'External [spec](https://example.com/spec) is not checked.' },
    ]);

    expect(findBrokenInlineLinks(content)).toEqual([]);
  });

  it('flags an unknown page and an unknown anchor, with where they are', () => {
    const content = buildContent([
      { type: 'paragraph', text: 'Go to [nowhere](/docs/nope).' },
      { type: 'paragraph', text: 'Go to [a missing anchor](/docs/guide#missing).' },
    ]);

    expect(findBrokenInlineLinks(content)).toEqual([
      '/docs/nope (guide#step-1[2] paragraph): no docs page "nope"',
      '/docs/guide#missing (guide#step-1[3] paragraph): page "guide" has no anchor "#missing"',
    ]);
  });

  it('checks every prose block type, including a faq answer, a table cell and a list item', () => {
    const content = buildContent([
      { type: 'callout', tone: 'info', text: '[a](/docs/missing-callout)' },
      { type: 'list', items: ['[b](/docs/missing-list)'] },
      { type: 'table', headers: ['h'], rows: [['[c](/docs/missing-table)']] },
      {
        type: 'faq',
        items: [{ question: '[d](/docs/missing-question)?', answer: [{ type: 'paragraph', text: '[e](/docs/missing-answer)' }] }],
      },
    ]);

    const broken = findBrokenInlineLinks(content).map((entry) => entry.split(' ')[0]);

    expect(broken).toEqual([
      '/docs/missing-callout',
      '/docs/missing-list',
      '/docs/missing-table',
      '/docs/missing-question',
      '/docs/missing-answer',
    ]);
  });

  it('flags a link whose target the grammar rejects, so it is never silently turned into plain text', () => {
    const content = buildContent([
      { type: 'paragraph', text: '[x](javascript:alert) and [y](/en/docs/guide) and [z](http://example.com)' },
    ]);

    expect(findBrokenInlineLinks(content)).toEqual([
      'javascript:alert (guide#step-1[2] paragraph): not an allowed link target',
      '/en/docs/guide (guide#step-1[2] paragraph): not an allowed link target',
      'http://example.com (guide#step-1[2] paragraph): not an allowed link target',
    ]);
  });

  it('ignores markup that is not a link', () => {
    const content = buildContent([{ type: 'paragraph', text: '**bold** `code` [not a link] and [x] (y)' }]);

    expect(findBrokenInlineLinks(content)).toEqual([]);
  });
});
