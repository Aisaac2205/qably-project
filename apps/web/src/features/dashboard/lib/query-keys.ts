export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (projectId: string) => ['dashboard', 'summary', projectId] as const,
  traceability: (year: number, projectId: string, tz?: string) =>
    tz === undefined
      ? (['dashboard', 'traceability', year, projectId] as const)
      : (['dashboard', 'traceability', year, projectId, tz] as const),
}
