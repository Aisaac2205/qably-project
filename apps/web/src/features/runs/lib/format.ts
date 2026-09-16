import type { RunSource } from '@qably/types'

export function formatPassRate(passRate: number): string {
  return `${Math.round(passRate * 100)}%`
}

interface RunTitleSource {
  source: RunSource
  name: string
  commitMessage?: string
}

export interface RunTitleParts {
  title: string
  subtitle?: string
}

export function isCiRun(run: Pick<RunTitleSource, 'source'>): boolean {
  return run.source === 'github_actions'
}

/**
 * A CI push commonly produces one run per suite sharing the same commit, so
 * the commit message repeats across rows/views and can't tell them apart —
 * the suite is what actually differs, so it leads for CI runs, with the
 * commit message demoted to the secondary line. Manual/API runs keep their
 * given name as the title. Used identically by the runs list and the run
 * detail header so a run reads the same way in both places.
 */
export function runTitleParts(run: RunTitleSource, suiteName: string): RunTitleParts {
  if (isCiRun(run)) {
    // suiteName can arrive empty while the suite is still loading, failed to
    // load, or was deleted (run-progress-header.tsx passes suite?.name ?? '')
    // — fall back to the run's own name rather than rendering a blank title.
    return { title: suiteName || run.name, subtitle: run.commitMessage }
  }
  return { title: run.name, subtitle: suiteName || undefined }
}
