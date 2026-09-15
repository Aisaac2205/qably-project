export const PROJECT_ROOT_SECTION = 'repository'

export function projectRootPath(projectId: string): string {
  return `/projects/${projectId}/${PROJECT_ROOT_SECTION}`
}

export function projectSuitesPath(projectId: string): string {
  return `/projects/${projectId}/suites`
}

export function projectQualityPath(projectId: string): string {
  return `/projects/${projectId}/quality`
}

export function projectAerisPath(projectId: string): string {
  return `/projects/${projectId}/aeris`
}

export function reviewInboxPath(projectId: string): string {
  return `/review-inbox?project=${projectId}`
}

export function projectRunPath(projectId: string, runId: string): string {
  return `/projects/${projectId}/runs/${runId}`
}

export function suiteNewPath(projectId: string): string {
  return `/projects/${projectId}/suites/new`
}

export function suiteEditPath(projectId: string, suiteId: string): string {
  return `/projects/${projectId}/suites/${suiteId}/edit`
}

export function caseNewPath(projectId: string, suiteId: string): string {
  return `/projects/${projectId}/suites/${suiteId}/cases/new`
}

export function caseEditPath(projectId: string, suiteId: string, caseId: string): string {
  return `/projects/${projectId}/suites/${suiteId}/cases/${caseId}/edit`
}

export function reviewInboxProposalPath(proposalId: string): string {
  return `/review-inbox?proposal=${proposalId}`
}
