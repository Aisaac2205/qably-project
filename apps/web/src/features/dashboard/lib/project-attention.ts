import type { ProjectListItem } from '@qably/types'

const TIER_FAILING = 0
const TIER_RUNNING = 1
const TIER_MEASURED = 2
const TIER_UNMEASURED_WINDOW = 3
const TIER_NEVER_RUN = 4

function attentionTier(project: ProjectListItem): number {
  const { activity } = project

  if (activity === null) return TIER_NEVER_RUN
  if (activity.lastRunStatus === 'fail') return TIER_FAILING
  if (activity.lastRunStatus === 'running') return TIER_RUNNING
  if (activity.healthScore === null) return TIER_UNMEASURED_WINDOW

  return TIER_MEASURED
}

export function sortProjectsByAttention(
  projects: readonly ProjectListItem[],
): ProjectListItem[] {
  return [...projects].sort((a, b) => {
    const tierDelta = attentionTier(a) - attentionTier(b)
    if (tierDelta !== 0) return tierDelta

    const scoreA = a.activity?.healthScore ?? null
    const scoreB = b.activity?.healthScore ?? null
    if (scoreA !== null && scoreB !== null && scoreA !== scoreB) {
      return scoreA - scoreB
    }

    const runA = a.activity?.lastRunAt ?? ''
    const runB = b.activity?.lastRunAt ?? ''
    if (runA !== runB) return runB.localeCompare(runA)

    return a.name.localeCompare(b.name)
  })
}
