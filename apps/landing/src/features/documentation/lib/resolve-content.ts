import { API_BASE_URL_TOKEN } from '../content/types';
import type { DocBlock, DocContent } from '../content/types';

function resolveText(text: string, apiBaseUrl: string): string {
  return text.split(API_BASE_URL_TOKEN).join(apiBaseUrl);
}

function resolveBlock(block: DocBlock, apiBaseUrl: string): DocBlock {
  switch (block.type) {
    case 'paragraph':
    case 'subheading':
    case 'callout':
      return { ...block, text: resolveText(block.text, apiBaseUrl) };
    case 'list':
      return { ...block, items: block.items.map((item) => resolveText(item, apiBaseUrl)) };
    case 'code':
      return { ...block, code: resolveText(block.code, apiBaseUrl) };
    case 'codeGroup':
      return {
        ...block,
        label: resolveText(block.label, apiBaseUrl),
        variants: block.variants.map((variant) => ({
          ...variant,
          code: resolveText(variant.code, apiBaseUrl),
        })),
      };
    case 'table':
      return {
        ...block,
        headers: block.headers.map((header) => resolveText(header, apiBaseUrl)),
        rows: block.rows.map((row) => row.map((cell) => resolveText(cell, apiBaseUrl))),
      };
    case 'diagram':
      return {
        ...block,
        title: resolveText(block.title, apiBaseUrl),
        description: resolveText(block.description, apiBaseUrl),
        ...(block.caption === undefined ? {} : { caption: resolveText(block.caption, apiBaseUrl) }),
        ...(block.groups === undefined
          ? {}
          : { groups: block.groups.map((group) => ({ ...group, label: resolveText(group.label, apiBaseUrl) })) }),
        nodes: block.nodes.map((node) => ({
          ...node,
          label: resolveText(node.label, apiBaseUrl),
          ...(node.detail === undefined ? {} : { detail: resolveText(node.detail, apiBaseUrl) }),
        })),
        ...(block.edges === undefined
          ? {}
          : {
              edges: block.edges.map((edge) => ({
                ...edge,
                ...(edge.label === undefined ? {} : { label: resolveText(edge.label, apiBaseUrl) }),
              })),
            }),
      };
    case 'faq':
      return {
        ...block,
        items: block.items.map((item) => ({
          question: resolveText(item.question, apiBaseUrl),
          answer: item.answer.map((answerBlock) => resolveBlock(answerBlock, apiBaseUrl) as typeof answerBlock),
        })),
      };
    default:
      return block;
  }
}

export function resolveDocContent(content: DocContent, apiBaseUrl: string): DocContent {
  return {
    ...content,
    pages: content.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) => resolveBlock(block, apiBaseUrl)),
      })),
    })),
  };
}
