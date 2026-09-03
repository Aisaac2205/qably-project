'use client'

import Image from 'next/image'
import { useState } from 'react'
import { CheckCircle, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react'
import type { NotificationWebhook } from '@qably/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from '@/lib/i18n'

const LOGO_SRC: Record<NotificationWebhook['type'], string> = {
  slack: '/logos/slack.svg',
  discord: '/logos/discord.svg',
}

type TestState = 'idle' | 'pending' | 'success' | 'error'

interface NotificationWebhookRowProps {
  webhook: NotificationWebhook
  canWrite: boolean
  onToggleEnabled: (webhook: NotificationWebhook, enabled: boolean) => void
  onDelete: (webhook: NotificationWebhook) => void
  onTest: (webhook: NotificationWebhook) => Promise<void>
}

export function NotificationWebhookRow({
  webhook,
  canWrite,
  onToggleEnabled,
  onDelete,
  onTest,
}: NotificationWebhookRowProps) {
  const { t } = useTranslation()
  const [testState, setTestState] = useState<TestState>('idle')

  async function handleTest() {
    setTestState('pending')
    try {
      await onTest(webhook)
      setTestState('success')
    } catch {
      setTestState('error')
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5 sm:py-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Image
          src={LOGO_SRC[webhook.type]}
          alt=""
          width={20}
          height={20}
          className="size-5 shrink-0"
        />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-default truncate">
              {webhook.name}
            </span>
            {!webhook.enabled && (
              <Badge variant="outline">{t('settings.webhooks.disabled')}</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className="font-mono">{webhook.maskedUrl}</span>
            <span aria-hidden="true">·</span>
            <span>
              {webhook.eventTypes
                .map((eventType) => t(`settings.notifications.events.${eventType}`))
                .join(', ')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {testState === 'success' && (
          <CheckCircle
            size={16}
            weight="fill"
            className="text-pass"
            aria-label={t('settings.webhooks.testSuccess')}
          />
        )}
        {testState === 'error' && (
          <WarningCircle
            size={16}
            weight="fill"
            className="text-fail"
            aria-label={t('settings.webhooks.testError')}
          />
        )}

        {canWrite && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleTest}
              disabled={testState === 'pending'}
              aria-label={t('settings.webhooks.testAction', { name: webhook.name })}
            >
              <PaperPlaneTilt size={14} aria-hidden="true" />
            </Button>

            <Switch
              checked={webhook.enabled}
              onCheckedChange={(next) => onToggleEnabled(webhook, next)}
              aria-label={t('settings.webhooks.toggleAria', { name: webhook.name })}
            />

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onDelete(webhook)}
            >
              {t('common.delete')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
