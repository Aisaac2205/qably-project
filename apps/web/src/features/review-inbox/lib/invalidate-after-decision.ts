import type { QueryClient } from '@tanstack/react-query'
import { reviewKeys } from './query-keys'
import { suiteKeys, projectKeys } from '@/features/projects/lib/query-keys'

export function invalidateReviewLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: reviewKeys.all })
}

export function invalidateAfterDecision(queryClient: QueryClient): void {
  invalidateReviewLists(queryClient)
  void queryClient.invalidateQueries({ queryKey: suiteKeys.all })
  void queryClient.invalidateQueries({ queryKey: projectKeys.all })
}
