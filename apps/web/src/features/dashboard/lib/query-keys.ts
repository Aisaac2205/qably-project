export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (projectId: string) => ['dashboard', 'summary', projectId] as const,
  traceability: (year: number, projectId: string) =>
    ['dashboard', 'traceability', year, projectId] as const,
}
