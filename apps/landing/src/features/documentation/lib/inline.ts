/**
 * Inline markup of the docs prose: the one place that defines the grammar.
 *
 * Every prose string of the content (paragraphs, list items, table cells,
 * callouts, FAQ questions and answers, subheadings, diagram captions) may carry
 * this small, dependency-free markup. It is parsed into NODES and rendered by
 * building elements from them, never by injecting a string as HTML, so no
 * input can add a tag or an attribute: `<`, `&` and quotes are always text.
 *
 *   **bold**              strong. Holds text, `code` and links, never another bold.
 *   `code`                verbatim: nothing inside is parsed.
 *   [label](target)       link. The label holds text and `code`, not bold.
 *                         The target is one of:
 *                           /docs                    the docs overview
 *                           /docs/<slug>             a docs page (lowercase slug)
 *                           /docs/<slug>#<anchor>    an anchor of that page
 *                           /docs#<anchor>           an anchor of the overview
 *                           https://host.tld/...     an external https URL
 *                         The docs targets are locale-neutral: the renderer maps
 *                         them to the path of the current locale (the Spanish docs
 *                         root, or the English one under /en) and checks that the
 *                         page and the anchor exist in the page model. Anything
 *                         else (javascript:, data:, http:, a relative path, a URL
 *                         with credentials, a space or a quote) is rejected: only
 *                         its label is kept, as plain text.
 *
 * There are no backslash escapes, no italics and no autolinks. Rules that keep
 * ordinary prose safe:
 *   - a marker that finds no partner stays literal (`**open`, `a ` b`, `[x]`);
 *   - `**` opens only before a non-space character and closes only after one, so
 *     `2 ** 3 ** 4` is text;
 *   - a link with an empty label is not a link and stays literal;
 *   - a link target ends at the first `)`;
 *   - text longer than MAX_INLINE_LENGTH, or that costs more than MAX_PARSE_STEPS
 *     to parse, is plain text.
 */

export const MAX_INLINE_LENGTH = 5000;

/**
 * Work a single string may cost before it is given up as plain text. Ordinary
 * prose takes about one step per character; only input built to defeat the
 * partner search (thousands of openers that never close) comes near this.
 */
export const MAX_PARSE_STEPS = 50 * MAX_INLINE_LENGTH;

/** `slug` is null for the docs root, which is the overview page. */
export interface DocsLinkHref {
  kind: 'docs';
  slug: string | null;
  anchor: string | null;
}

export interface ExternalLinkHref {
  kind: 'external';
  url: string;
}

export type InlineHref = DocsLinkHref | ExternalLinkHref;

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'link'; href: InlineHref; children: InlineNode[] };

export interface InlineAnalysis {
  nodes: InlineNode[];
  /** Targets of the well-formed links the grammar refused, in reading order. */
  rejectedTargets: string[];
}

type RunMode = 'top' | 'strong' | 'label';

interface ParseState {
  rejected: string[];
  steps: number;
}

class ParseBudgetExceeded extends Error {}

interface Run {
  nodes: InlineNode[];
  /** Index of the marker that ended the run: `**` in strong mode, `]` in label mode. */
  end: number;
  closed: boolean;
}

const DOCS_TARGET = /^\/docs(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?(?:#([A-Za-z0-9_-]+))?$/;
const UNSAFE_URL_CHARACTER = /[\s"'<>`\\(){}]/;

function classifyTarget(target: string): InlineHref | null {
  const docs = DOCS_TARGET.exec(target);

  if (docs !== null) {
    return { kind: 'docs', slug: docs[1] ?? null, anchor: docs[2] ?? null };
  }

  if (!target.startsWith('https://') || UNSAFE_URL_CHARACTER.test(target)) return null;

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return null;
  }

  const hasCredentials = url.username !== '' || url.password !== '';

  if (url.protocol !== 'https:' || hasCredentials || !url.hostname.includes('.')) return null;

  return { kind: 'external', url: target };
}

function pushText(nodes: InlineNode[], value: string): void {
  if (value === '') return;

  const last = nodes[nodes.length - 1];

  if (last !== undefined && last.type === 'text') {
    last.value += value;
  } else {
    nodes.push({ type: 'text', value });
  }
}

function pushNodes(nodes: InlineNode[], more: InlineNode[]): void {
  for (const node of more) {
    if (node.type === 'text') pushText(nodes, node.value);
    else nodes.push(node);
  }
}

function isSpace(character: string | undefined): boolean {
  return character === undefined || /\s/.test(character);
}

function plainText(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text' || node.type === 'code') return node.value;

      return plainText(node.children);
    })
    .join('');
}

function parseRun(input: string, start: number, mode: RunMode, state: ParseState): Run {
  const nodes: InlineNode[] = [];
  let text = '';
  let index = start;

  const flush = (): void => {
    pushText(nodes, text);
    text = '';
  };

  while (index < input.length) {
    state.steps += 1;
    if (state.steps > MAX_PARSE_STEPS) throw new ParseBudgetExceeded();

    const character = input[index]!;

    if (mode === 'label' && character === ']') {
      flush();

      return { nodes, end: index, closed: true };
    }

    if (character === '*' && input[index + 1] === '*') {
      if (mode === 'strong') {
        // A closing marker needs content before it and a non-space character right before it.
        if (index > start && !isSpace(input[index - 1])) {
          flush();

          return { nodes, end: index, closed: true };
        }
      } else if (mode === 'top' && !isSpace(input[index + 2])) {
        const rejectedBefore = state.rejected.length;
        const run = parseRun(input, index + 2, 'strong', state);

        if (run.closed) {
          flush();
          nodes.push({ type: 'strong', children: run.nodes });
          index = run.end + 2;
          continue;
        }

        // No closing marker: the opener is text and its content is parsed again as such.
        state.rejected.length = rejectedBefore;
      }

      text += '**';
      index += 2;
      continue;
    }

    if (character === '`') {
      const close = input.indexOf('`', index + 1);

      if (close > index + 1) {
        flush();
        nodes.push({ type: 'code', value: input.slice(index + 1, close) });
        index = close + 1;
        continue;
      }
    }

    if (character === '[' && mode !== 'label') {
      const link = parseLink(input, index, state);

      if (link !== null) {
        flush();
        pushNodes(nodes, link.nodes);
        index = link.end;
        continue;
      }
    }

    text += character;
    index += 1;
  }

  flush();

  return { nodes, end: index, closed: false };
}

/** Parses `[label](target)` at `index`; null when it is not a link (the `[` stays literal). */
function parseLink(
  input: string,
  index: number,
  state: ParseState,
): { nodes: InlineNode[]; end: number } | null {
  const label = parseRun(input, index + 1, 'label', state);

  if (!label.closed || input[label.end + 1] !== '(') return null;

  const close = input.indexOf(')', label.end + 2);

  if (close === -1 || plainText(label.nodes).trim() === '') return null;

  const target = input.slice(label.end + 2, close);
  const href = classifyTarget(target);

  if (href === null) {
    state.rejected.push(target);

    return { nodes: label.nodes, end: close + 1 };
  }

  return { nodes: [{ type: 'link', href, children: label.nodes }], end: close + 1 };
}

export function inspectInline(input: string): InlineAnalysis {
  if (input === '') return { nodes: [], rejectedTargets: [] };
  if (input.length > MAX_INLINE_LENGTH) {
    return { nodes: [{ type: 'text', value: input }], rejectedTargets: [] };
  }

  const state: ParseState = { rejected: [], steps: 0 };

  try {
    return { nodes: parseRun(input, 0, 'top', state).nodes, rejectedTargets: state.rejected };
  } catch (error) {
    if (!(error instanceof ParseBudgetExceeded)) throw error;

    return { nodes: [{ type: 'text', value: input }], rejectedTargets: [] };
  }
}

export function parseInline(input: string): InlineNode[] {
  return inspectInline(input).nodes;
}

/** The words of a string without its markers: what a reader, a heading id or a text guard compares. */
export function stripInline(input: string): string {
  return plainText(parseInline(input));
}

function collectLinks(nodes: readonly InlineNode[], links: InlineHref[]): void {
  for (const node of nodes) {
    if (node.type === 'link') links.push(node.href);
    if (node.type === 'strong' || node.type === 'link') collectLinks(node.children, links);
  }
}

/** Every valid link of a string, in reading order. */
export function collectInlineLinks(input: string): InlineHref[] {
  const links: InlineHref[] = [];

  collectLinks(parseInline(input), links);

  return links;
}
