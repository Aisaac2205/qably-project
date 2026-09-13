const SEPARATOR = /\s*>\s*/g;
const WHITESPACE = /\s+/g;

export function normalizeAutomationKey(key: string): string {
  return key.replace(SEPARATOR, ' ').replace(WHITESPACE, ' ').trim();
}
