export const reviewKeys = {
  all: ['review'] as const,
  list: (filters: { projectId?: string; status?: string } = {}) =>
    ['review', 'proposals', filters.projectId ?? 'all', filters.status ?? 'all'] as const,
  detail: (id: string) => ['review', 'proposal', id] as const,
}

export const duplicateKeys = {
  all: ['duplicates'] as const,
  detail: (proposalId: string) => ['duplicates', proposalId] as const,
}
