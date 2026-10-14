import type { ProposalOrigin } from '@qably/types'
import type { ProposalListItem } from '../api/review.api'

export interface OriginGroup {
  key: string
  count: number
  /** The origin of the first proposal of the group; every member shares its kind and commit. */
  origin: ProposalOrigin
}

function groupKey(origin: ProposalOrigin): string {
  return origin.kind === 'push' ? `push:${origin.commitSha ?? 'unknown'}` : origin.kind
}

/**
 * Groups proposals by why they are in the inbox: one group per pushed commit,
 * one per other origin kind, largest first. Ties keep first-seen order.
 */
export function summarizeOrigins(proposals: readonly ProposalListItem[]): OriginGroup[] {
  const groups = new Map<string, OriginGroup>()

  for (const proposal of proposals) {
    if (proposal.origin === undefined) continue
    const key = groupKey(proposal.origin)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, { key, count: 1, origin: proposal.origin })
    else group.count += 1
  }

  return [...groups.values()].sort((a, b) => b.count - a.count)
}
