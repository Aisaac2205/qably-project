export const reviewKeys = {
  all: ['review'] as const,
  detail: (id: string) => ['review', 'proposal', id] as const,
  inbox: (filters: {
    projectId?: string
    status: string
    duplicatesOnly?: boolean
    search?: string
  }) =>
    [
      'review',
      'inbox',
      filters.projectId ?? 'all',
      filters.status,
      filters.duplicatesOnly === true ? 'duplicates' : 'all',
      filters.search?.trim() || '',
    ] as const,
  inboxCounts: (filters: { projectId?: string; search?: string } = {}) =>
    ['review', 'inbox-counts', filters.projectId ?? 'all', filters.search?.trim() || ''] as const,
}
