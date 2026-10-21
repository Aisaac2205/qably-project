import { describe, expect, it } from 'vitest';
import { en } from '../content/en';
import { es } from '../content/es';
import type { DocBlock, DocPage, DocSection } from '../content/types';
import {
  MIN_TOC_ENTRIES,
  buildPageToc,
  hasPageToc,
  pickActiveTocId,
  slugifyHeading,
  subheadingId,
} from './toc';

function section(id: string, title: string, blocks: DocBlock[]): DocSection {
  return { id, navLabel: title, title, blocks };
}

function page(title: string, sections: DocSection[]): DocPage {
  return { slug: 'p', navLabel: title, title, description: 'A page.', sections };
}

const para: DocBlock = { type: 'paragraph', text: 'text' };

describe('slugifyHeading', () => {
  it('lowercases, strips accents and joins words with hyphens', () => {
    expect(slugifyHeading('Selección del repositorio')).toBe('seleccion-del-repositorio');
    expect(slugifyHeading('JavaScript y TypeScript')).toBe('javascript-y-typescript');
  });

  it('collapses punctuation and trims the ends', () => {
    expect(slugifyHeading('  What is it? (really) ')).toBe('what-is-it-really');
  });

  it('falls back to a fixed slug when nothing is left', () => {
    expect(slugifyHeading('???')).toBe('section');
  });
});

describe('subheadingId', () => {
  it('prefixes the slug with its section id so ids stay unique across sections', () => {
    expect(subheadingId('step-2-connect-repository', 'Selección del repositorio')).toBe(
      'step-2-connect-repository-seleccion-del-repositorio',
    );
  });
});

describe('buildPageToc', () => {
  it('lists the sections of a multi-section page, each followed by its subheadings', () => {
    const toc = buildPageToc(
      page('Quickstart', [
        section('step-1', '1. First', [para]),
        section('step-2', '2. Second', [
          para,
          { type: 'subheading', text: 'Pick one' },
          para,
          { type: 'subheading', text: 'Register it' },
        ]),
        section('step-3', '3. Third', [para]),
      ]),
    );

    expect(toc).toEqual([
      { id: 'step-1', label: '1. First', level: 2 },
      { id: 'step-2', label: '2. Second', level: 2 },
      { id: 'step-2-pick-one', label: 'Pick one', level: 3 },
      { id: 'step-2-register-it', label: 'Register it', level: 3 },
      { id: 'step-3', label: '3. Third', level: 2 },
    ]);
  });

  it('skips the section entry when its heading is not rendered and promotes its subheadings to h2', () => {
    const toc = buildPageToc(
      page('Reference: keys', [
        section('reference-keys', 'Reference: keys', [para, { type: 'subheading', text: 'Rotation' }]),
      ]),
    );

    expect(toc).toEqual([{ id: 'reference-keys-rotation', label: 'Rotation', level: 2 }]);
  });

  it('ignores blocks that are not subheadings, including FAQ answers', () => {
    const toc = buildPageToc(
      page('Help', [
        section('faq', 'Help', [
          { type: 'faq', items: [{ question: 'Why?', answer: [para] }] },
          { type: 'callout', tone: 'info', text: 'note' },
        ]),
      ]),
    );

    expect(toc).toEqual([]);
  });

  it('shows a table of contents only from two entries on', () => {
    expect(MIN_TOC_ENTRIES).toBe(2);
    expect(hasPageToc([])).toBe(false);
    expect(hasPageToc([{ id: 'a', label: 'A', level: 2 }])).toBe(false);
    expect(
      hasPageToc([
        { id: 'a', label: 'A', level: 2 },
        { id: 'b', label: 'B', level: 3 },
      ]),
    ).toBe(true);
  });
});

describe.each([
  { name: 'es', content: es },
  { name: 'en', content: en },
])('the $name docs table of contents', ({ content }) => {
  it('has unique entry ids on every page', () => {
    for (const current of content.pages) {
      const ids = buildPageToc(current).map((entry) => entry.id);

      expect(new Set(ids).size, `page "${current.slug}"`).toBe(ids.length);
    }
  });

  it('derives subheading anchors that never collide with a section id or with each other', () => {
    const sectionIds = new Set(content.pages.flatMap((current) => current.sections.map((candidate) => candidate.id)));
    const seen = new Set<string>();

    for (const current of content.pages) {
      for (const candidate of current.sections) {
        for (const block of candidate.blocks) {
          if (block.type !== 'subheading') continue;

          const id = subheadingId(candidate.id, block.text);

          expect(sectionIds.has(id), `"${id}" shadows a section id`).toBe(false);
          expect(seen.has(id), `"${id}" is used twice`).toBe(false);
          seen.add(id);
        }
      }
    }
  });

  it('gives the quickstart its five steps in order', () => {
    const quickstart = content.pages.find((candidate) => candidate.slug === 'quickstart')!;
    const stepIds = buildPageToc(quickstart)
      .filter((entry) => entry.level === 2)
      .map((entry) => entry.id);

    expect(stepIds).toEqual([
      'step-1-create-project',
      'step-2-connect-repository',
      'step-3-api-key',
      'step-4-report-ci',
      'step-5-verify',
    ]);
  });

  it('never repeats a subheading text inside one section, because its id comes from the text', () => {
    for (const current of content.pages) {
      for (const candidate of current.sections) {
        const texts = candidate.blocks.flatMap((block) => (block.type === 'subheading' ? [block.text] : []));

        expect(new Set(texts).size, `section "${candidate.id}"`).toBe(texts.length);
      }
    }
  });
});

describe('the table of contents of es and en', () => {
  it('has the same shape on every page', () => {
    for (const esPage of es.pages) {
      const enPage = en.pages.find((candidate) => candidate.slug === esPage.slug)!;
      const shape = (entries: ReturnType<typeof buildPageToc>) =>
        entries.map((entry) => entry.level);

      expect(shape(buildPageToc(esPage)), `page "${esPage.slug}"`).toEqual(shape(buildPageToc(enPage)));
    }
  });
});

describe('pickActiveTocId', () => {
  const targets = [
    { id: 'a', top: -400 },
    { id: 'b', top: 40 },
    { id: 'c', top: 600 },
  ];

  it('returns null when there is nothing to track', () => {
    expect(pickActiveTocId([], 96, false)).toBeNull();
  });

  it('picks the last target whose top has passed the offset', () => {
    expect(pickActiveTocId(targets, 96, false)).toBe('b');
  });

  it('picks the first target while the reader is above all of them', () => {
    expect(
      pickActiveTocId(
        [
          { id: 'a', top: 300 },
          { id: 'b', top: 900 },
        ],
        96,
        false,
      ),
    ).toBe('a');
  });

  it('picks the last target once the page is scrolled to the bottom', () => {
    expect(pickActiveTocId(targets, 96, true)).toBe('c');
  });

  it('treats a target sitting on the offset as reached and tolerates one pixel of rounding', () => {
    expect(pickActiveTocId([{ id: 'a', top: 96 }, { id: 'b', top: 98 }], 96, false)).toBe('a');
    expect(pickActiveTocId([{ id: 'a', top: 96 }, { id: 'b', top: 97 }], 96, false)).toBe('b');
  });
});
