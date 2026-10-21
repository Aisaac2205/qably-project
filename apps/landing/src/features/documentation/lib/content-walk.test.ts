import { describe, expect, it } from 'vitest';
import type { DocBlock, DocContent } from '../content/types';
import { forEachProse, walkBlocks } from './content-walk';

function contentWith(blocks: DocBlock[]): DocContent {
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
    navGroups: [{ label: 'Start', pageSlugs: ['guide'] }],
    pages: [
      {
        slug: 'guide',
        navLabel: 'Guide',
        title: 'Guide',
        description: 'A guide.',
        sections: [{ id: 'intro', navLabel: 'Intro', title: 'Intro', blocks }],
      },
    ],
  };
}

describe('walkBlocks', () => {
  it('visits every block of every section with its page, section and a readable location', () => {
    const content = contentWith([
      { type: 'paragraph', text: 'a' },
      { type: 'code', language: 'shell', code: 'ls' },
    ]);

    const visits = [...walkBlocks(content)];

    expect(visits.map((visit) => [visit.page.slug, visit.section.id, visit.block.type, visit.where])).toEqual([
      ['guide', 'intro', 'paragraph', 'guide#intro[0] paragraph'],
      ['guide', 'intro', 'code', 'guide#intro[1] code'],
    ]);
  });

  it('descends into the answers of a faq block', () => {
    const content = contentWith([
      {
        type: 'faq',
        items: [{ question: 'Q?', answer: [{ type: 'paragraph', text: 'A.' }] }],
      },
    ]);

    expect([...walkBlocks(content)].map((visit) => visit.where)).toEqual([
      'guide#intro[0] faq',
      'guide#intro[0] faq[0].answer[0] paragraph',
    ]);
  });
});

describe('forEachProse', () => {
  it('visits the text of every block that goes through the inline renderer', () => {
    const content = contentWith([
      { type: 'paragraph', text: 'paragraph' },
      { type: 'subheading', text: 'subheading' },
      { type: 'callout', tone: 'info', text: 'callout' },
      { type: 'list', items: ['item one', 'item two'] },
      { type: 'table', headers: ['head'], rows: [['cell one', 'cell two']] },
      {
        type: 'faq',
        items: [
          {
            question: 'question',
            answer: [
              { type: 'paragraph', text: 'answer paragraph' },
              { type: 'list', items: ['answer item'] },
              { type: 'code', language: 'shell', code: 'answer code' },
            ],
          },
        ],
      },
    ]);
    const seen: string[] = [];

    forEachProse(content, (value) => seen.push(value));

    expect(seen).toEqual([
      'paragraph',
      'subheading',
      'callout',
      'item one',
      'item two',
      'head',
      'cell one',
      'cell two',
      'question',
      'answer paragraph',
      'answer item',
    ]);
  });

  it('never visits code, which is verbatim and not parsed', () => {
    const content = contentWith([
      { type: 'code', language: 'shell', code: 'echo **not markup**' },
      {
        type: 'codeGroup',
        label: 'Run it',
        variants: [
          { language: 'shell', label: 'sh', code: 'echo `date`' },
          { language: 'shell', label: 'zsh', code: 'echo $(date)' },
        ],
      },
    ]);
    const seen: string[] = [];

    forEachProse(content, (value) => seen.push(value));

    expect(seen).toEqual([]);
  });

  it('reports where each text lives', () => {
    const content = contentWith([{ type: 'paragraph', text: 'x' }]);
    const locations: string[] = [];

    forEachProse(content, (_value, where) => locations.push(where));

    expect(locations).toEqual(['guide#intro[0] paragraph']);
  });
});
