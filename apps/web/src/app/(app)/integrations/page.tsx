/**
 * /integrations — list of connections (GitHub repo, Slack channel, email)
 * with a "Simulate CI webhook" button per github connection to demo the
 * end-to-end flow without real GitHub.
 *
 * Composition follows the project standard:
 *   header (h1 + subtitle) → KPI row → list
 */
'use client'

import { useState } from 'react'
import { useConnections } from '@/features/integrations'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plug, Plugs, ArrowsClockwise, CheckCircle, XCircle, CircleNotch } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import type { Connection } from '@qably/types'

function StatusChip({ status }: { status: Connection['status'] }) {
  if (status === 'connected') {
    return (
      <Badge variant="pass" className="gap-1">
        <CheckCircle size={12} weight="fill" />
        Connected
      </Badge>
    )
  }
  if (status === 'disconnected') {
    return (
      <Badge variant="skip" className="gap-1">
        <XCircle size={12} weight="fill" />
        Disconnected
      </Badge>
    )
  }
  if (status === 'error') {
    return (
      <Badge variant="fail" className="gap-1">
        <XCircle size={12} weight="fill" />
        Error
      </Badge>
    )
  }
  return (
    <Badge variant="warn" className="gap-1">
      <CircleNotch size={12} />
      Pending
    </Badge>
  )
}

function SimulateCiButton({ connection, onSimulated }: { connection: Connection; onSimulated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const simulate = async () => {
    setLoading(true)
    setError(null)
    try {
      // Simulates a GitHub `check_run` webhook. In dev, this bypasses HMAC
      // (env-gated per demo recommendation #1000) and writes to the mock-store.
      const payload = {
        action: 'completed',
        check_run: {
          id: Date.now(),
          head_sha: 'sim-sha-' + Date.now(),
          name: 'CI',
          status: 'completed',
          conclusion: 'success',
          details_url: 'https://github.com/sim/run/' + Date.now(),
          external_id: connection.id,
        },
        check_suite: {
          id: Date.now(),
          head_sha: 'sim-sha-' + Date.now(),
          head_branch: 'main',
          repository: { full_name: connection.config?.repoUrl ?? 'acme/repo' },
        },
        repository: { full_name: connection.config?.repoUrl ?? 'acme/repo' },
      }
      const res = await fetch('/api/webhooks/ci/github', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        setError(`HTTP ${res.status}`)
      } else {
        onSimulated()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  if (connection.type !== 'github') return null

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={simulate} disabled={loading}>
        <ArrowsClockwise size={14} className="mr-1.5" />
        Simulate CI webhook
      </Button>
      {error && <span className="text-xs text-fail">{error}</span>}
    </div>
  )
}

export default function IntegrationsPage() {
  const { connections, transition } = useConnections()
  const { t } = useTranslation()

  const connected = connections.filter((c) => c.status === 'connected').length
  const pending = connections.filter((c) => c.status === 'pending').length

  return (
    <div className="flex flex-col">
      <div className="px-6 pt-6 pb-4 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight text-default">{t('modules.integrations.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('modules.integrations.subtitle')}</p>
      </div>

      <div className="px-6 pb-4">
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          <Kpi label={t('modules.integrations.kpiTotal')} value={connections.length} />
          <Kpi label={t('modules.integrations.kpiConnected')} value={connected} accent="pass" />
          <Kpi label={t('modules.integrations.kpiPending')} value={pending} accent="warn" />
        </div>
      </div>

      <div className="px-6 pb-6 space-y-2">
        {connections.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">{t('modules.integrations.empty')}</p>
        ) : (
          connections.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  {c.status === 'connected' ? (
                    <Plug size={18} weight="duotone" className="text-pass" />
                  ) : (
                    <Plugs size={18} weight="duotone" className="text-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-default truncate">{c.name}</span>
                    <StatusChip status={c.status} />
                    <span className="text-xs text-muted">·</span>
                    <span className="text-xs text-muted uppercase tracking-wide">{c.type}</span>
                  </div>
                  {c.config?.repoUrl && (
                    <p className="text-xs text-muted font-mono mt-0.5 truncate">{c.config.repoUrl}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <SimulateCiButton connection={c} onSimulated={() => undefined} />
                  {c.status === 'connected' ? (
                    <Button size="sm" variant="ghost" onClick={() => transition(c.id, 'disconnect')}>
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => transition(c.id, 'connect')}>
                      Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: 'pass' | 'warn' }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-0.5 ${accent === 'pass' ? 'text-pass' : accent === 'warn' ? 'text-warn' : 'text-default'}`}>
        {value}
      </div>
    </div>
  )
}
