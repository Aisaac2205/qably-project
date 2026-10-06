import { compareSuiteSortKeys, type SuiteSortKey } from '@qably/types';
import { encodeSuiteSummariesCursor } from './suite-summaries-cursor';

interface PagingWindow {
  limit: number;
  cursor?: SuiteSortKey | undefined;
}

interface CutPage<T> {
  page: T[];
  nextCursor: string | null;
}

export function cutPage<T>(
  items: readonly T[],
  keyOf: (item: T) => SuiteSortKey,
  { limit, cursor }: PagingWindow,
): CutPage<T> {
  const ordered = items
    .map((item) => ({ item, key: keyOf(item) }))
    .sort((a, b) => compareSuiteSortKeys(a.key, b.key));
  const remaining =
    cursor === undefined
      ? ordered
      : ordered.filter(({ key }) => compareSuiteSortKeys(key, cursor) > 0);
  const lookahead = remaining.slice(0, limit + 1);
  const taken = lookahead.slice(0, limit);
  const last = taken[taken.length - 1];

  return {
    page: taken.map(({ item }) => item),
    nextCursor:
      lookahead.length > limit && last !== undefined
        ? encodeSuiteSummariesCursor(last.key)
        : null,
  };
}
