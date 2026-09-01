export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
  repository: (id: string) => ['projects', id, 'repository'] as const,
}

export const suiteKeys = {
  all: ['suites'] as const,
  list: (projectId: string) => ['suites', 'list', projectId] as const,
  detail: (id: string) => ['suites', id] as const,
}
