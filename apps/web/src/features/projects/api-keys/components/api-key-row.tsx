'use client'

import type { ApiKey } from '@qably/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { formatApiKeyDate } from '../lib/format'

interface ApiKeyRowProps {
  apiKey: ApiKey
  onRevoke: (apiKey: ApiKey) => void
}

export function ApiKeyRow({ apiKey, onRevoke }: ApiKeyRowProps) {
  const { t } = useTranslation()
  const isRevoked = apiKey.revokedAt !== undefined

  const secondaryLine = apiKey.revokedAt !== undefined
    ? t('apiKeys.revokedAt', { date: formatApiKeyDate(apiKey.revokedAt) })
    : apiKey.lastUsedAt
      ? t('apiKeys.lastUsed', { date: formatApiKeyDate(apiKey.lastUsedAt) })
      : t('apiKeys.neverUsed')

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5 sm:py-3.5">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-default truncate">{apiKey.name}</span>
          <span className="rounded bg-canvas border border-border px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted">
            {apiKey.prefix}…{apiKey.lastFour}
          </span>
          {isRevoked && <Badge variant="outline">{t('apiKeys.revoked')}</Badge>}
        </div>
        <div className="text-xs text-muted">
          {secondaryLine} · {t('apiKeys.created', { date: formatApiKeyDate(apiKey.createdAt) })}
        </div>
      </div>

      {!isRevoked && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => onRevoke(apiKey)}
        >
          {t('common.revoke')}
        </Button>
      )}
    </div>
  )
}
