import type { QueryClient } from '@tanstack/react-query'
import { runKeys } from './query-keys'

export function markRunPagesStale(queryClient: QueryClient, projectId: string): void {
  void queryClient.invalidateQueries({ queryKey: runKeys.pages(projectId), refetchType: 'none' })
}
