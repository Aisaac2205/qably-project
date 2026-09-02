export const apiKeyKeys = {
  all: ['api-keys'] as const,
  list: (projectId: string) => ['api-keys', 'list', projectId] as const,
}
