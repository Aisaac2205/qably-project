import type { DocBlock, DocContent, DocPage, DocSection } from '../content/types';

export interface BlockVisit {
  page: DocPage;
  section: DocSection;
  block: DocBlock;
  /** Readable location for messages: `quickstart#step-1[2] paragraph`. */
  where: string;
}

/** Every block of every section, in reading order, descending into the answers of a FAQ. */
export function* walkBlocks(content: DocContent): Generator<BlockVisit> {
  for (const page of content.pages) {
    for (const section of page.sections) {
      for (const [index, block] of section.blocks.entries()) {
        const where = `${page.slug}#${section.id}[${index}] ${block.type}`;

        yield { page, section, block, where };

        if (block.type !== 'faq') continue;

        for (const [itemIndex, item] of block.items.entries()) {
          for (const [answerIndex, answer] of item.answer.entries()) {
            yield {
              page,
              section,
              block: answer,
              where: `${page.slug}#${section.id}[${index}] faq[${itemIndex}].answer[${answerIndex}] ${answer.type}`,
            };
          }
        }
      }
    }
  }
}

function visitBlockProse(block: DocBlock, where: string, visit: (text: string, where: string) => void): void {
  switch (block.type) {
    case 'paragraph':
    case 'subheading':
    case 'callout':
      visit(block.text, where);
      break;
    case 'list':
      for (const item of block.items) visit(item, where);
      break;
    case 'table':
      for (const header of block.headers) visit(header, where);
      for (const row of block.rows) {
        for (const cell of row) visit(cell, where);
      }
      break;
    case 'faq':
      for (const item of block.items) visit(item.question, where);
      break;
    case 'diagram':
      if (block.caption !== undefined) visit(block.caption, where);
      for (const node of block.nodes) {
        if (node.detail !== undefined) visit(node.detail, where);
      }
      break;
    default:
      break;
  }
}

/**
 * Calls `visit` for every string that goes through the inline renderer, with
 * the place it lives in. Code blocks are never visited: their text is verbatim.
 * A FAQ visits its questions at the FAQ block and its answers as blocks of their own.
 */
export function forEachProse(content: DocContent, visit: (text: string, where: string) => void): void {
  for (const { block, where } of walkBlocks(content)) visitBlockProse(block, where, visit);
}
