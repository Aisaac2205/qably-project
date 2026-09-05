export const runKeys = {
  all: ['runs'] as const,
  list: (projectId: string) => ['runs', 'list', projectId] as const,
  page: (projectId: string, source: string) =>
    ['runs', 'page', projectId, source] as const,
  detail: (id: string) => ['runs', id] as const,
}
