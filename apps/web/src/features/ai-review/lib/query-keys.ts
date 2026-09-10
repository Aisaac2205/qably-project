export const chatKeys = {
  all: ['chat'] as const,
  threads: (projectId: string) => ['chat', 'threads', projectId] as const,
  thread: (projectId: string, threadId: string) =>
    ['chat', 'thread', projectId, threadId] as const,
}

export const duplicateKeys = {
  all: ['duplicates'] as const,
  detail: (proposalId: string) => ['duplicates', proposalId] as const,
}
