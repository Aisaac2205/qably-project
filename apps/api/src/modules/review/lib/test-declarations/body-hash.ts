import { createHash } from 'node:crypto';

const LINE_BREAK = /\r\n|\r|\n/;

/**
 * Line endings become "\n" and every line loses its trailing whitespace, so a
 * checkout's line-ending setting or an editor stripping trailing spaces never
 * reads as a change. That includes trailing spaces inside a multi-line string
 * or template literal, which do change the runtime value: a change made only
 * of those is not seen. Everything else counts, comments and indentation
 * included.
 */
function normalizeSourceText(text: string): string {
  return text
    .split(LINE_BREAK)
    .map((line) => line.trimEnd())
    .join('\n');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** The fingerprint of one declaration: sha256 hex of its normalized text. */
export function hashDeclarationText(text: string): string {
  return sha256(normalizeSourceText(text));
}

/**
 * sha256 hex of several source texts, grouped, each normalized like
 * `hashDeclarationText`. The grouping is part of what is hashed, so moving a
 * statement from one group to another is a change.
 */
export function hashSourceGroups(
  groups: readonly (readonly string[])[],
): string {
  return sha256(
    JSON.stringify(groups.map((group) => group.map(normalizeSourceText))),
  );
}
