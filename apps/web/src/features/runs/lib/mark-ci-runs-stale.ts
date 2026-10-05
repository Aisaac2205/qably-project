import type { QueryClient } from '@tanstack/react-query'
import { ciRunKeys } from './query-keys'

export function markCiRunsStale(queryClient: QueryClient, projectId: string): void {
  void queryClient.invalidateQueries({ queryKey: ciRunKeys.page(projectId), refetchType: 'none' })
  void queryClient.invalidateQueries({ queryKey: ciRunKeys.details, refetchType: 'none' })
}
