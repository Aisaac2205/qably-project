import type { InboxFeedbackToast } from '../hooks/use-inbox-feedback'

export const MAX_VISIBLE_ERRORS = 3

export interface FeedbackErrorGroup {
  toast: InboxFeedbackToast
  count: number
  ids: number[]
}

export interface FeedbackErrorSummary {
  visible: FeedbackErrorGroup[]
  hiddenCount: number
  hiddenIds: number[]
}

function identityOf(error: InboxFeedbackToast): string {
  return JSON.stringify([error.message, error.href ?? null])
}

export function summarizeErrors(
  errors: readonly InboxFeedbackToast[],
  maxVisible: number = MAX_VISIBLE_ERRORS,
): FeedbackErrorSummary {
  const groups = new Map<string, FeedbackErrorGroup>()

  for (const error of errors) {
    const identity = identityOf(error)
    const previous = groups.get(identity)
    groups.delete(identity)
    groups.set(identity, {
      toast: error,
      count: (previous?.count ?? 0) + 1,
      ids: [...(previous?.ids ?? []), error.id],
    })
  }

  const ordered = [...groups.values()]
  const hidden = ordered.slice(0, Math.max(0, ordered.length - maxVisible))

  return {
    visible: ordered.slice(hidden.length),
    hiddenCount: hidden.reduce((total, group) => total + group.count, 0),
    hiddenIds: hidden.flatMap((group) => group.ids),
  }
}
