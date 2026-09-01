export const runKeys = {
  all: ['runs'] as const,
  list: (projectId: string) => ['runs', 'list', projectId] as const,
  detail: (id: string) => ['runs', id] as const,
}
