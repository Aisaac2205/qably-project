export const PROJECT_ROOT_SECTION = 'repository'

export function projectRootPath(projectId: string): string {
  return `/projects/${projectId}/${PROJECT_ROOT_SECTION}`
}

export function projectSuitesPath(projectId: string): string {
  return `/projects/${projectId}/suites`
}
