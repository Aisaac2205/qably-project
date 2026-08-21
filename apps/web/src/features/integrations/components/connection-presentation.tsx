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
const logos: Record<string, string> = {
  Slack: '/logos/slack.svg',
  '#qa-alerts': '/logos/slack.svg',
  'GitHub Actions': '/logos/githubactions.svg',
  GitHub: '/logos/github.svg',
  Bitbucket: '/logos/bitbucket.svg',
  GitLab: '/logos/gitlab.svg',
  Discord: '/logos/discord.svg',
  Jira: '/logos/jira.svg',
  'Jira Software': '/logos/jira.svg',
  'Qably Alerts': '/qably-icon.svg',
  Qably: '/qably-icon.svg',
}

const typeLogos: Record<string, string> = {
  slack: '/logos/slack.svg',
  discord: '/logos/discord.svg',
  jira: '/logos/jira.svg',
  bitbucket: '/logos/bitbucket.svg',
  gitlab: '/logos/gitlab.svg',
  github: '/logos/github.svg',
  qably: '/qably-icon.svg',
}

export function connectionResource(
  connection: Connection,
  notConnected: string,
  t?: (key: string) => string,
): string {
  if (connection.config?.descriptionKey && t) {
    return t(connection.config.descriptionKey)
  }
  if (connection.config?.description) return connection.config.description
  if (connection.config?.repoUrl) return connection.config.repoUrl
  if (connection.type === 'slack') return connection.name
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

export function ConnectionLogo({ name, type }: { name: string; type?: Connection['type'] }) {
  let src = logos[name]
  if (!src && type) {
    src = typeLogos[type]
  }
  if (!src) {
    const lower = name.toLowerCase()
    if (lower.includes('slack')) src = '/logos/slack.svg'
    else if (lower.includes('discord')) src = '/logos/discord.svg'
    else if (lower.includes('jira')) src = '/logos/jira.svg'
    else if (lower.includes('bitbucket')) src = '/logos/bitbucket.svg'
    else if (lower.includes('gitlab')) src = '/logos/gitlab.svg'
    else if (lower.includes('qably')) src = '/qably-icon.svg'
    else if (lower.includes('github')) src = '/logos/github.svg'
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-surface p-2 shadow-2xs">
      {src ? (
        <Image src={src} alt="" width={22} height={22} className="size-full object-contain" />
      ) : (
        <Circle size={18} className="text-muted" aria-hidden="true" />
      )}
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
