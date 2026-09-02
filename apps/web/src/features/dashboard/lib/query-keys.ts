export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (projectId: string) => ['dashboard', 'summary', projectId] as const,
}
