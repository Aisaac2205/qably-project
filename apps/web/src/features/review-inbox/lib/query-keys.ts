export const reviewKeys = {
  all: ['review'] as const,
  list: ['review', 'proposals'] as const,
  detail: (id: string) => ['review', 'proposal', id] as const,
}
