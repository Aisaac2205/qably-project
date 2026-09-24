import { normalizeTitle } from '../../../common/quality/case-health';

export function tokenize(text: string): Set<string> {
  const normalized = normalizeTitle(text);
  return new Set(normalized.length === 0 ? [] : normalized.split(' '));
}

export function jaccard(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
