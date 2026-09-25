import type { InfiniteData } from '@tanstack/react-query'
import type {
  ProposalListItem,
  ReviewInboxPageResult,
  ReviewInboxStatusCounts,
} from '../api/review.api'

export interface RemovedItemPosition {
  pageIndex: number
  itemIndex: number
  item: ProposalListItem
}

export interface RemoveFromPagesResult {
  data: InfiniteData<ReviewInboxPageResult> | undefined
  removed: RemovedItemPosition | null
}

export function removeFromPages(
  data: InfiniteData<ReviewInboxPageResult> | undefined,
  proposalId: string,
): RemoveFromPagesResult {
  if (data === undefined) return { data: undefined, removed: null }

  let removed: RemovedItemPosition | null = null

  const pages = data.pages.map((page, pageIndex) => {
    if (removed !== null) return page
    const itemIndex = page.items.findIndex((item) => item.id === proposalId)
    if (itemIndex === -1) return page
    removed = { pageIndex, itemIndex, item: page.items[itemIndex] }
    return { ...page, items: page.items.filter((item) => item.id !== proposalId) }
  })

  if (removed === null) return { data, removed: null }

  return { data: { ...data, pages }, removed }
}

export function reinsertAt(
  data: InfiniteData<ReviewInboxPageResult> | undefined,
  position: RemovedItemPosition,
): InfiniteData<ReviewInboxPageResult> | undefined {
  if (data === undefined) return undefined
  if (position.pageIndex >= data.pages.length) return data

  const alreadyPresent = data.pages.some((page) =>
    page.items.some((item) => item.id === position.item.id),
  )
  if (alreadyPresent) return data

  const pages = data.pages.map((page, pageIndex) => {
    if (pageIndex !== position.pageIndex) return page
    const items = [...page.items]
    const insertAt = Math.min(position.itemIndex, items.length)
    items.splice(insertAt, 0, position.item)
    return { ...page, items }
  })

  return { ...data, pages }
}

export function adjustCounts(
  counts: ReviewInboxStatusCounts,
  status: keyof ReviewInboxStatusCounts,
  delta: number,
): ReviewInboxStatusCounts {
  return { ...counts, [status]: Math.max(0, counts[status] + delta) }
}
