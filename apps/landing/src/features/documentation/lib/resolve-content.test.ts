import { describe, expect, it } from 'vitest';
import { en } from '../content/en';
import { API_BASE_URL_TOKEN, type DocContent } from '../content/types';
import { parseInline } from './inline';
import { resolveDocContent } from './resolve-content';

function buildContent(): DocContent {
  return {
    docsLabel: 'Docs',
    breadcrumbAriaLabel: 'Breadcrumb',
    navAriaLabel: 'Documentation navigation',
    menuLabel: 'Documentation menu',
    tocLabel: 'On this page',
    pagerAriaLabel: 'Previous and next pages',
    previousLabel: 'Previous',
    nextLabel: 'Next',
    copyCodeLabel: 'Copy code',
    copiedLabel: 'Copied!',
    labels: en.labels,
    navGroups: [{ label: 'Reference', pageSlugs: ['reference', 'guide'] }],
    pages: [
      {
        slug: 'reference',
        navLabel: 'Reference',
        title: 'Reference',
        description: 'The reference page.',
        sections: [
          {
            id: 'reference',
            navLabel: 'Reference',
            title: 'Reference',
            blocks: [
              { type: 'paragraph', text: `Call ${API_BASE_URL_TOKEN}/runs/ingest` },
              { type: 'list', items: [`See ${API_BASE_URL_TOKEN}/health`] },
              { type: 'code', language: 'shell', code: `curl ${API_BASE_URL_TOKEN}/runs/ingest` },
              {
                type: 'codeGroup',
                label: `POST ${API_BASE_URL_TOKEN}/runs/ingest`,
                variants: [
                  { language: 'shell', label: 'cURL', code: `curl ${API_BASE_URL_TOKEN}/runs/ingest` },
                  { language: 'python', label: 'Python', code: `requests.post("${API_BASE_URL_TOKEN}/runs/ingest")` },
                ],
              },
              { type: 'table', headers: [API_BASE_URL_TOKEN], rows: [[`${API_BASE_URL_TOKEN}/runs/ingest`]] },
              {
                type: 'faq',
                items: [
                  {
                    question: 'Where do I send results?',
                    answer: [{ type: 'paragraph', text: `${API_BASE_URL_TOKEN}/runs/ingest` }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        slug: 'guide',
        navLabel: 'Guide',
        title: 'Guide',
        description: 'The guide page.',
        sections: [
          {
            id: 'guide',
            navLabel: 'Guide',
            title: 'Guide',
            blocks: [{ type: 'paragraph', text: `Send it to ${API_BASE_URL_TOKEN}` }],
          },
        ],
      },
    ],
  };
}

describe('resolveDocContent', () => {
  it('replaces every occurrence of the API base URL token', () => {
    const resolved = resolveDocContent(buildContent(), 'https://api.qably.dev');
    const [paragraph, list, code, codeGroup, table, faq] = resolved.pages[0]!.sections[0]!.blocks;

    expect(paragraph).toMatchObject({ text: 'Call https://api.qably.dev/runs/ingest' });
    expect(list).toMatchObject({ items: ['See https://api.qably.dev/health'] });
    expect(code).toMatchObject({ code: 'curl https://api.qably.dev/runs/ingest' });
    expect(codeGroup).toMatchObject({
      label: 'POST https://api.qably.dev/runs/ingest',
      variants: [
        { label: 'cURL', code: 'curl https://api.qably.dev/runs/ingest' },
        { label: 'Python', code: 'requests.post("https://api.qably.dev/runs/ingest")' },
      ],
    });
    expect(table).toMatchObject({
      headers: ['https://api.qably.dev'],
      rows: [['https://api.qably.dev/runs/ingest']],
    });
    expect(faq).toMatchObject({
      items: [{ answer: [{ text: 'https://api.qably.dev/runs/ingest' }] }],
    });
  });

  it('resolves the token in every page, not only the first', () => {
    const resolved = resolveDocContent(buildContent(), 'https://api.qably.dev');

    expect(resolved.pages[1]!.sections[0]!.blocks[0]).toMatchObject({
      text: 'Send it to https://api.qably.dev',
    });
  });

  it('keeps the page model (slugs, titles, nav) untouched', () => {
    const content = buildContent();
    const resolved = resolveDocContent(content, 'https://api.qably.dev');

    expect(resolved.navGroups).toEqual(content.navGroups);
    expect(resolved.pages.map((page) => [page.slug, page.title, page.description])).toEqual(
      content.pages.map((page) => [page.slug, page.title, page.description]),
    );
  });

  it('leaves content untouched when the token never appears', () => {
    const content = buildContent();
    const withoutToken: DocContent = {
      ...content,
      pages: [
        {
          ...content.pages[0]!,
          sections: [
            { ...content.pages[0]!.sections[0]!, blocks: [{ type: 'paragraph', text: 'No token here.' }] },
          ],
        },
      ],
      navGroups: [{ label: 'Reference', pageSlugs: ['reference'] }],
    };

    const resolved = resolveDocContent(withoutToken, 'https://api.qably.dev');

    expect(resolved.pages[0]!.sections[0]!.blocks[0]).toMatchObject({ text: 'No token here.' });
  });

  it('replaces the token inside inline markup, so a link target built on it becomes a real external link', () => {
    const content = buildContent();
    const withMarkup: DocContent = {
      ...content,
      pages: [
        {
          ...content.pages[0]!,
          sections: [
            {
              ...content.pages[0]!.sections[0]!,
              blocks: [
                { type: 'paragraph', text: `Check [the health endpoint](${API_BASE_URL_TOKEN}/health) and **${API_BASE_URL_TOKEN}**.` },
                { type: 'callout', tone: 'info', text: `Use \`${API_BASE_URL_TOKEN}/runs\`.` },
              ],
            },
          ],
        },
      ],
      navGroups: [{ label: 'Reference', pageSlugs: ['reference'] }],
    };

    const resolved = resolveDocContent(withMarkup, 'https://api.qably.dev');
    const [paragraph, callout] = resolved.pages[0]!.sections[0]!.blocks as { text: string }[];

    expect(parseInline(paragraph!.text)).toEqual([
      { type: 'text', value: 'Check ' },
      {
        type: 'link',
        href: { kind: 'external', url: 'https://api.qably.dev/health' },
        children: [{ type: 'text', value: 'the health endpoint' }],
      },
      { type: 'text', value: ' and ' },
      { type: 'strong', children: [{ type: 'text', value: 'https://api.qably.dev' }] },
      { type: 'text', value: '.' },
    ]);
    expect(parseInline(callout!.text)).toEqual([
      { type: 'text', value: 'Use ' },
      { type: 'code', value: 'https://api.qably.dev/runs' },
      { type: 'text', value: '.' },
    ]);
  });
});
