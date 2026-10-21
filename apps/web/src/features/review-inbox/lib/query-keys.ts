export const reviewKeys = {
  all: ['review'] as const,
  detail: (id: string) => ['review', 'proposal', id] as const,
  inbox: (filters: {
    projectId?: string
    status: string
    duplicatesOnly?: boolean
    search?: string
    batch?: string
  }) =>
    [
      'review',
      'inbox',
      filters.projectId ?? 'all',
      filters.status,
      filters.duplicatesOnly === true ? 'duplicates' : 'all',
      filters.search?.trim() || '',
      filters.batch || '',
    ] as const,
  /** Every inbox counts query, whatever its filters: the prefix to invalidate. */
  allInboxCounts: ['review', 'inbox-counts'] as const,
  inboxCounts: (filters: { projectId?: string; search?: string } = {}) =>
    ['review', 'inbox-counts', filters.projectId ?? 'all', filters.search?.trim() || ''] as const,
}
