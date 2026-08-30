export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
  repository: (id: string) => ['projects', id, 'repository'] as const,
}
