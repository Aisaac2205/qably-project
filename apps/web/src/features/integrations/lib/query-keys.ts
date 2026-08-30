export const connectionKeys = {
  all: ['connections'] as const,
  availableRepos: ['connections', 'available-repos'] as const,
  stack: (repo: string) => ['connections', 'stack', repo] as const,
}
