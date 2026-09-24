export const reviewKeys = {
  all: ['review'] as const,
  list: (filters: { projectId?: string; status?: string } = {}) =>
    ['review', 'proposals', filters.projectId ?? 'all', filters.status ?? 'all'] as const,
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

export const duplicateKeys = {
  all: ['duplicates'] as const,
  detail: (proposalId: string) => ['duplicates', proposalId] as const,
}
