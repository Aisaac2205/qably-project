'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import {
  ArrowsClockwise,
  CheckCircle,
  Circle,
  CircleNotch,
  Plus,
  WarningCircle,
} from '@phosphor-icons/react'
import type { Connection } from '@qably/types'
import { useConnections } from '@/features/integrations'
import { useRunAggregate } from '@/features/runs'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { InspectorPanel } from '@/components/ui/inspector-panel'
import { PageHeader } from '@/components/ui/page-header'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'

const logos: Record<Connection['name'], string> = {
  Slack: '/logos/slack.svg',
  'GitHub Actions': '/logos/githubactions.svg',
  GitHub: '/logos/github.svg',
  Bitbucket: '/logos/bitbucket.svg',
  Gmail: '/logos/google-gmail-svgrepo-com.svg',
}

const activity = [
  { id: 'activity-1', connection: 'Slack', title: 'activityAlert1245', detail: 'activitySlackQa', time: 'time2Minutes' },
  { id: 'activity-2', connection: 'GitHub Actions', title: 'activityWorkflowCompleted', detail: 'activityGithubActions', time: 'time5Minutes' },
  { id: 'activity-3', connection: 'Slack', title: 'activityAlert1244', detail: 'activitySlackQa', time: 'time18Minutes' },
  { id: 'activity-4', connection: 'GitHub Actions', title: 'activityWorkflowStarted', detail: 'activityGithubActions', time: 'time27Minutes' },
]

function connectionResource(connection: Connection, notConnected: string): string {
  if (connection.config?.repoUrl) return connection.config.repoUrl
  if (connection.type === 'slack') return connection.name
  if (connection.config?.description) return connection.config.description
  return notConnected
}

function ConnectionStatus({ status }: { status: Connection['status'] }) {
  const { t } = useTranslation()

  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pass">
        <CheckCircle size={14} weight="fill" aria-hidden="true" />
        {t('modules.integrations.connected')}
      </span>
    )
  }

  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warn">
        <CircleNotch size={14} aria-hidden="true" />
        {t('modules.integrations.pending')}
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fail">
        <WarningCircle size={14} weight="fill" aria-hidden="true" />
        {t('modules.integrations.error')}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <Circle size={14} weight="fill" aria-hidden="true" />
      {t('modules.integrations.available')}
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
  const [error, setError] = useState<'server' | 'network' | null>(null)
  const inFlight = useRef(false)
  const { t } = useTranslation()

  if (connection.config?.category !== 'ci') return null

  const simulate = async () => {
    if (inFlight.current) return

    inFlight.current = true
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
      if (!response.ok) setError('server')
    } catch {
      setError('network')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  const actionLabel = t(error ? 'modules.integrations.simulateCiRetry' : 'modules.integrations.simulateCi')
  const errorDescription = error === 'server'
    ? t('modules.integrations.simulateCiServerErrorDescription')
    : t('modules.integrations.simulateCiNetworkErrorDescription')

  return (
    <div className="flex w-full min-w-0 flex-col items-end gap-1 sm:w-auto">
      <Button size="sm" variant="outline" onClick={simulate} disabled={loading} aria-label={actionLabel}>
        <ArrowsClockwise size={14} aria-hidden="true" />
        {actionLabel}
      </Button>
      {error ? (
        <StateView
          kind="error"
          title={t('modules.integrations.simulateCiErrorTitle')}
          description={errorDescription}
          className="min-h-0 w-full gap-2 px-2 py-2 sm:w-56"
        />
      ) : null}
    </div>
  )
}

function ConnectionActions({
  connection,
  runId,
  onTransition,
}: {
  connection: Connection
  runId: string | null
  onTransition: (id: string, event: 'connect' | 'disconnect') => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex w-full flex-wrap justify-end gap-2">
      <SimulateCiButton connection={connection} runId={runId} />
      {connection.status === 'connected' ? (
        <Button size="sm" variant="outline" onClick={() => onTransition(connection.id, 'disconnect')}>
          {t('modules.integrations.disconnect')}
        </Button>
      ) : (
        <Button size="sm" onClick={() => onTransition(connection.id, 'connect')}>
          {t('modules.integrations.connect')}
        </Button>
      )}
    </div>
  )
}

export default function IntegrationsPage() {
  const { connections, create, transition } = useConnections()
  const { runs } = useRunAggregate()
  const { t } = useTranslation()
  const firstRunningRun = runs.find((run) => run.status === 'running')
  const visibleConnections = connections.filter((connection) => connection.config?.category !== 'scm')

  const addIntegration = () => {
    create({
      type: 'email',
      name: t('modules.integrations.newName'),
      config: { description: t('modules.integrations.newDescription') },
    })
  }

  const notConnected = t('modules.integrations.notConnected')
  const lastActivity = (connection: Connection) => connection.lastSyncAt
    ? t('modules.integrations.activityRecorded')
    : t('modules.integrations.noActivity')

  return (
    <div className="flex flex-col">
      <div className="px-4 pb-6 pt-6 sm:px-6">
        <PageHeader
          title={t('modules.integrations.title')}
          description={t('modules.integrations.subtitle')}
          actions={(
            <Button onClick={addIntegration}>
              <Plus size={16} weight="bold" aria-hidden="true" />
              {t('modules.integrations.add')}
            </Button>
          )}
        />
      </div>

      <div className="grid gap-5 px-4 pb-6 sm:px-6 lg:grid-cols-3">
        <section className="overflow-hidden rounded-xl border border-border bg-surface lg:col-span-2" aria-labelledby="connections-heading">
          <div className="border-b border-border px-5 py-4">
            <h2 id="connections-heading" className="text-sm font-semibold text-default">
              {t('modules.integrations.listHeading')}
            </h2>
          </div>
          <ul aria-label={t('modules.integrations.listCaption')} className="divide-y divide-border md:hidden">
            {visibleConnections.map((connection) => (
              <li key={connection.id} className="min-w-0 space-y-4 px-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <ConnectionLogo name={connection.name} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-default">{connection.name}</p>
                    <ConnectionStatus status={connection.status} />
                  </div>
                </div>
                <dl className="grid min-w-0 gap-2 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-muted">{t('modules.integrations.resource')}</dt>
                    <dd className="break-words text-default">{connectionResource(connection, notConnected)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted">{t('modules.integrations.lastActivity')}</dt>
                    <dd className="text-default">{lastActivity(connection)}</dd>
                  </div>
                </dl>
                <ConnectionActions connection={connection} runId={firstRunningRun?.id ?? null} onTransition={transition} />
              </li>
            ))}
          </ul>
          <DataTable caption={t('modules.integrations.listCaption')} wrapperClassName="hidden md:block">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">{t('modules.integrations.service')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('modules.integrations.resource')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('modules.integrations.status')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('modules.integrations.lastActivity')}</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">{t('modules.integrations.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleConnections.map((connection) => (
                  <tr key={connection.id}>
                    <td className="px-3 py-4 sm:px-5">
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:block"><ConnectionLogo name={connection.name} /></div>
                        <span className="break-words text-sm font-semibold text-default">{connection.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted">{connectionResource(connection, notConnected)}</td>
                    <td className="px-4 py-4"><ConnectionStatus status={connection.status} /></td>
                    <td className="px-4 py-4 text-sm text-muted">
                      {lastActivity(connection)}
                    </td>
                    <td className="px-3 py-4 sm:px-5">
                      <ConnectionActions connection={connection} runId={firstRunningRun?.id ?? null} onTransition={transition} />
                    </td>
                  </tr>
                ))}
              </tbody>
          </DataTable>
        </section>

        <InspectorPanel title={t('modules.integrations.recentActivity')}>
          <ul className="divide-y divide-border">
            {activity.map((item) => (
              <li key={item.id} className="flex gap-3 px-5 py-4">
                <ConnectionLogo name={item.connection} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-default">{t(`modules.integrations.${item.title}`)}</p>
                  <p className="mt-0.5 text-xs text-muted">{t(`modules.integrations.${item.detail}`)}</p>
                </div>
                <time className="shrink-0 text-xs text-muted">{t(`modules.integrations.${item.time}`)}</time>
              </li>
            ))}
          </ul>
        </InspectorPanel>
      </div>
    </div>
  )
}
