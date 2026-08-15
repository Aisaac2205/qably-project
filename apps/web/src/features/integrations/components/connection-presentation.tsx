'use client'

import Image from 'next/image'
import { CheckCircle, Circle, CircleNotch, WarningCircle } from '@phosphor-icons/react'
import type { Connection } from '@qably/types'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'

/**
 * Shared connection presentation — governance surfaces (Settings) and any
 * remaining connection-aware view render these instead of duplicating
 * status/logo/action markup per consumer.
 */
const logos: Record<Connection['name'], string> = {
  Slack: '/logos/slack.svg',
  'GitHub Actions': '/logos/githubactions.svg',
  GitHub: '/logos/github.svg',
  Bitbucket: '/logos/bitbucket.svg',
  Gmail: '/logos/google-gmail-svgrepo-com.svg',
}

export function connectionResource(connection: Connection, notConnected: string): string {
  if (connection.config?.repoUrl) return connection.config.repoUrl
  if (connection.type === 'slack') return connection.name
  if (connection.config?.description) return connection.config.description
  return notConnected
}

export function ConnectionStatus({ status }: { status: Connection['status'] }) {
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

export function ConnectionLogo({ name }: { name: Connection['name'] }) {
  const src = logos[name]

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface p-2">
      {src ? <Image src={src} alt="" width={24} height={24} className="size-full object-contain" /> : <Circle size={18} className="text-muted" aria-hidden="true" />}
    </div>
  )
}

export function ConnectionActions({
  connection,
  onTransition,
}: {
  connection: Connection
  onTransition: (id: string, event: 'connect' | 'disconnect') => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex w-full flex-wrap justify-end gap-2">
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
