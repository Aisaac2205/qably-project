'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  ArrowsClockwise,
  CheckCircle,
  Circle,
  CircleNotch,
  Plus,
} from '@phosphor-icons/react'
import type { Connection } from '@qably/types'
import { useConnections } from '@/features/integrations'
import { useRunAggregate } from '@/features/runs'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'

const logos: Record<Connection['name'], string> = {
  Slack: '/logos/slack.svg',
  'GitHub Actions': '/logos/githubactions.svg',
  GitHub: '/logos/github.svg',
  Bitbucket: '/logos/bitbucket.svg',
  Gmail: '/logos/google-gmail-svgrepo-com.svg',
}

const activity = [
  { id: 'activity-1', connection: 'Slack', title: 'Alert #1245 delivered', detail: 'Slack · #qa-alerts', time: '2 min ago' },
  { id: 'activity-2', connection: 'GitHub Actions', title: 'Workflow "E2E Tests" completed', detail: 'GitHub Actions', time: '5 min ago' },
  { id: 'activity-3', connection: 'Slack', title: 'Alert #1244 delivered', detail: 'Slack · #qa-alerts', time: '18 min ago' },
  { id: 'activity-4', connection: 'GitHub Actions', title: 'Workflow "Smoke Tests" started', detail: 'GitHub Actions', time: '27 min ago' },
]

function connectionResource(connection: Connection): string {
  if (connection.config?.repoUrl) return connection.config.repoUrl
  if (connection.type === 'slack') return connection.name
  if (connection.config?.description) return connection.config.description
  return 'Not connected'
}

function ConnectionStatus({ status }: { status: Connection['status'] }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pass">
        <CheckCircle size={14} weight="fill" aria-hidden="true" />
        Connected
      </span>
    )
  }

  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warn">
        <CircleNotch size={14} aria-hidden="true" />
        Pending
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <Circle size={14} weight="fill" aria-hidden="true" />
      Available
    </span>
  )
}

function ConnectionLogo({ name }: { name: Connection['name'] }) {
  const src = logos[name]

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface p-2">
      {src ? <Image src={src} alt="" width={24} height={24} className="size-full object-contain" /> : <Circle size={18} className="text-muted" aria-hidden="true" />}
    </div>
  )
}

function SimulateCiButton({ connection, runId }: { connection: Connection; runId: string | null }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (connection.config?.category !== 'ci') return null

  const simulate = async () => {
    setLoading(true)
    setError(null)
    try {
      const timestamp = Date.now()
      const run = runId ?? connection.id
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
      if (!response.ok) setError(`HTTP ${response.status}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={simulate} disabled={loading}>
        <ArrowsClockwise size={14} aria-hidden="true" />
        Simulate CI
      </Button>
      {error && <span className="text-xs text-fail">{error}</span>}
    </div>
  )
}

export default function IntegrationsPage() {
  const { connections, create, transition } = useConnections()
  const { runs } = useRunAggregate()
  const { t } = useTranslation()
  const firstRunningRun = runs.find((run) => run.status === 'running')

  const addIntegration = () => {
    create({ type: 'email', name: 'New integration', config: { description: 'Configure a notification channel' } })
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 px-6 pb-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-default">{t('modules.integrations.title')}</h1>
          <p className="mt-0.5 text-sm text-muted">{t('modules.integrations.subtitle')}</p>
        </div>
        <Button onClick={addIntegration}>
          <Plus size={16} weight="bold" aria-hidden="true" />
          Add integration
        </Button>
      </div>

      <div className="grid gap-5 px-6 pb-6 lg:grid-cols-3">
        <section className="overflow-hidden rounded-xl border border-border bg-surface lg:col-span-2" aria-labelledby="connections-heading">
          <div className="border-b border-border px-5 py-4">
            <h2 id="connections-heading" className="text-sm font-semibold text-default">Integrations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-left">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Service</th>
                  <th scope="col" className="px-4 py-3 font-medium">Connected resource</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last activity</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {connections.map((connection) => (
                  <tr key={connection.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <ConnectionLogo name={connection.name} />
                        <span className="text-sm font-semibold text-default">{connection.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted">{connectionResource(connection)}</td>
                    <td className="px-4 py-4"><ConnectionStatus status={connection.status} /></td>
                    <td className="px-4 py-4 text-sm text-muted">
                      {connection.lastSyncAt ? 'Activity recorded' : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <SimulateCiButton connection={connection} runId={firstRunningRun?.id ?? null} />
                        {connection.status === 'connected' ? (
                          <Button size="sm" variant="outline" onClick={() => transition(connection.id, 'disconnect')}>Disconnect</Button>
                        ) : (
                          <Button size="sm" onClick={() => transition(connection.id, 'connect')}>Connect</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="overflow-hidden rounded-xl border border-border bg-surface" aria-labelledby="activity-heading">
          <div className="border-b border-border px-5 py-4">
            <h2 id="activity-heading" className="text-sm font-semibold text-default">Recent activity</h2>
          </div>
          <ul className="divide-y divide-border">
            {activity.map((item) => (
              <li key={item.id} className="flex gap-3 px-5 py-4">
                <ConnectionLogo name={item.connection} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-default">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
                </div>
                <time className="shrink-0 text-xs text-muted">{item.time}</time>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
