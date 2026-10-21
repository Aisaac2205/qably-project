import { createHash } from 'node:crypto';

const LINE_BREAK = /\r\n|\r|\n/;

/**
 * The fingerprint of one declaration: a sha256 hex digest of its call text
 * with line endings normalized to "\n" and trailing whitespace trimmed from
 * every line, so a checkout's line-ending setting or an editor stripping
 * trailing spaces never reads as a change. Everything else counts, comments
 * and indentation included.
 */
export function hashDeclarationText(text: string): string {
  const normalized = text
    .split(LINE_BREAK)
    .map((line) => line.trimEnd())
    .join('\n');

  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
