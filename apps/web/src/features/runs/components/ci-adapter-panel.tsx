'use client'

import { useRef, useState } from 'react'
import { ArrowsClockwise } from '@phosphor-icons/react'
import { useConnections } from '@/features/integrations'
import { useProject, useRuns } from '@/lib/use-mock-store'
import { Button } from '@/components/ui/button'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'

/**
 * Project-scoped CI adapter — Phase 2 split of the CI simulator out of the
 * monolithic /integrations page (REQ: separate CI adapters into Runs).
 * Renders nothing when no CI-category connection matches this project's
 * `githubRepo`; there is no per-project connection model to query directly.
 */
export function CiAdapterPanel({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const project = useProject(projectId)
  const { connections } = useConnections()
  const runs = useRuns(projectId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<'server' | 'network' | null>(null)
  const inFlight = useRef(false)

  const connection = connections.find(
    (c) => c.config?.category === 'ci' && project?.githubRepo && c.config?.repoUrl === project.githubRepo,
  )

  if (!connection) return null

  const runningRun = runs.find((r) => r.status === 'running')

  const simulate = async () => {
    if (inFlight.current) return

    inFlight.current = true
    setLoading(true)
    setError(null)
    try {
      const timestamp = Date.now()
      const run = runningRun?.id ?? connection.id
      const payload = {
        action: 'completed',
        check_run: {
          id: timestamp,
          head_sha: `sim-sha-${timestamp}`,
          name: 'CI',
          status: 'completed',
          conclusion: 'success',
          details_url: `https://github.com/sim/run/${timestamp}`,
          external_id: run,
        },
        check_suite: {
          id: timestamp,
          head_sha: `sim-sha-${timestamp}`,
          head_branch: 'main',
          repository: { full_name: connection.config?.repoUrl ?? 'acme/repo' },
        },
        repository: { full_name: connection.config?.repoUrl ?? 'acme/repo' },
      }
      const response = await fetch('/api/webhooks/ci/github', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) setError('server')
    } catch {
      setError('network')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  const actionLabel = t(error ? 'runs.simulateCiRetry' : 'runs.simulateCi')
  const errorDescription = error === 'server'
    ? t('runs.simulateCiServerErrorDescription')
    : t('runs.simulateCiNetworkErrorDescription')

  return (
    <section
      aria-labelledby="ci-adapter-heading"
      className="mb-4 rounded-xl border border-border bg-surface px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="ci-adapter-heading" className="text-sm font-semibold text-default">
            {t('runs.ciAdapterHeading')}
          </h2>
          <p className="text-xs text-muted">{connection.config?.repoUrl}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button size="sm" variant="outline" onClick={simulate} disabled={loading} aria-label={actionLabel}>
            <ArrowsClockwise size={14} aria-hidden="true" />
            {actionLabel}
          </Button>
          {error ? (
            <StateView
              kind="error"
              title={t('runs.simulateCiErrorTitle')}
              description={errorDescription}
              className="min-h-0 w-full gap-2 px-2 py-2 sm:w-56"
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}
