export const UNTRUSTED_TEXT_MAX_LENGTH = 200;

const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}]+/gu;
const BLOCK_MARKERS = /`{3,}|<{3,}|>{3,}/g;
const ROLE_MARKERS = /\b(system|assistant|model|user)\s*:/gi;
const WHITESPACE_RUNS = /\s+/g;

export function sanitizeUntrustedText(
  value: string,
  maxLength: number = UNTRUSTED_TEXT_MAX_LENGTH,
): string {
  const flattened = value
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(BLOCK_MARKERS, ' ')
    .replace(ROLE_MARKERS, '$1')
    .replace(WHITESPACE_RUNS, ' ')
    .trim();

  if (flattened.length <= maxLength) return flattened;

  return `${flattened.slice(0, maxLength).trimEnd()}...`;
}

export function stripBlockDelimiters(
  value: string,
  delimiters: string[],
): string {
  return delimiters.reduce(
    (text, delimiter) => text.split(delimiter).join(''),
    value,
  );
}
