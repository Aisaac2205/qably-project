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

/**
 * Case creation/editing lives inline on the suite edit page now — the
 * dedicated /cases/new and /cases/:id/edit routes just redirect here with
 * the target case preselected via ?case=.
 */
export function suiteEditNewCasePath(projectId: string, suiteId: string): string {
  return `${suiteEditPath(projectId, suiteId)}?case=new`
}

export function suiteEditCasePath(projectId: string, suiteId: string, caseId: string): string {
  return `${suiteEditPath(projectId, suiteId)}?case=${encodeURIComponent(caseId)}`
}

export function reviewInboxProposalPath(proposalId: string): string {
  return `/review-inbox?proposal=${proposalId}`
}
