import type { CiRunSummaryRecord } from '@qably/types'

export const PROJECT = 'proj-1'

export const NOW = new Date('2026-10-03T12:00:00.000Z')

export function ciRunSummary(
  id: string,
  overrides: Partial<CiRunSummaryRecord> = {},
): CiRunSummaryRecord {
  return {
    id,
    projectId: PROJECT,
    source: 'github_actions',
    externalId: '900',
    status: 'failing',
    startedAt: '2026-10-03T11:50:00.000Z',
    lastReportedAt: '2026-10-03T11:55:00.000Z',
    commitMessage: 'Fix flaky checkout\n\nA longer explanation of the fix',
    runNumber: 42,
    branch: 'main',
    commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
    commitAuthor: 'ana',
    ...overrides,
  }
}
