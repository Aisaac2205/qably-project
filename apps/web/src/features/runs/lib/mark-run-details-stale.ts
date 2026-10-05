import type { QueryClient } from '@tanstack/react-query'
import { runKeys } from './query-keys'

export function markRunDetailsStale(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: runKeys.details, refetchType: 'none' })
}
