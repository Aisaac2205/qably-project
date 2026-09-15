import type { RunSource } from '@qably/types'

export function formatPassRate(passRate: number): string {
  return `${Math.round(passRate * 100)}%`
}

interface RunTitleSource {
  source: RunSource
  name: string
  commitMessage?: string
}

export function isCiRun(run: Pick<RunTitleSource, 'source'>): boolean {
  return run.source === 'github_actions'
}

/**
 * CI runs are already marked by the GitHub Actions icon, so a generic "CI #N"
 * title would just restate the source. The commit message carries the actual
 * evidence of what changed, so it takes over as the title when present.
 */
export function runDisplayTitle(run: RunTitleSource): string {
  return isCiRun(run) && run.commitMessage ? run.commitMessage : run.name
}
