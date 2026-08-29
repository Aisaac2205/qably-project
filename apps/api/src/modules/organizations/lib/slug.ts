import { randomBytes } from 'node:crypto';

const MAX_SLUG_LENGTH = 48;
const FALLBACK_SLUG = 'workspace';
const COMBINING_MARKS = /[̀-ͯ]/g;

function trimHyphens(value: string): string {
  return value.replace(/^-+|-+$/g, '');
}

export function toSlug(name: string): string {
  const normalized = trimHyphens(
    name
      .normalize('NFD')
      .replace(COMBINING_MARKS, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-'),
  );

  const capped = trimHyphens(normalized.slice(0, MAX_SLUG_LENGTH));

  return capped === '' ? FALLBACK_SLUG : capped;
}

export function withSlugSuffix(base: string, attempt: number): string {
  if (attempt === 0) return base;

  const suffix = randomBytes(3).toString('hex');
  const room = MAX_SLUG_LENGTH - suffix.length - 1;

  return `${trimHyphens(base.slice(0, room))}-${suffix}`;
}
