'use client'

import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import type { ApiKey } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { ApiKeyRow } from './api-key-row'

interface ApiKeyListProps {
  apiKeys: ApiKey[]
  isLoading: boolean
  isError: boolean
  projectId: string
  onCreateClick: () => void
  onRevoke: (apiKey: ApiKey) => void
}

export function ApiKeyList({
  apiKeys,
  isLoading,
  isError,
  projectId,
  onCreateClick,
  onRevoke,
}: ApiKeyListProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return <StateView kind="loading" title={t('common.loading')} />
  }

  if (isError) {
    return <StateView kind="error" title={t('apiKeys.loadError')} />
  }

  if (apiKeys.length === 0) {
    return (
      <StateView
        kind="empty"
        title={t('apiKeys.noKeysTitle')}
        description={t('apiKeys.noKeysDescription')}
        action={
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button type="button" size="sm" onClick={onCreateClick}>
              <Plus size={14} weight="bold" aria-hidden="true" />
              {t('apiKeys.newKey')}
            </Button>
            <Link
              href={`/projects/${projectId}/runs`}
              className="text-sm font-medium text-default hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('apiKeys.viewRunsCta')}
            </Link>
          </div>
        }
      />
    )
  }

  const active = apiKeys.filter((key) => key.revokedAt === undefined)
  const revoked = apiKeys.filter((key) => key.revokedAt !== undefined)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button type="button" size="sm" onClick={onCreateClick}>
          <Plus size={14} weight="bold" aria-hidden="true" />
          {t('apiKeys.newKey')}
        </Button>
      </div>

      {active.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-default">{t('apiKeys.active')}</h2>
          <Card className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <CardContent className="p-0">
              <EntityList aria-label={t('apiKeys.ariaKeyList')}>
                {active.map((key) => (
                  <li key={key.id}>
                    <ApiKeyRow apiKey={key} onRevoke={onRevoke} />
                  </li>
                ))}
              </EntityList>
            </CardContent>
          </Card>
        </section>
      )}

      {revoked.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">{t('apiKeys.revoked')}</h2>
          <Card className="rounded-xl border border-border bg-surface shadow-card overflow-hidden opacity-70">
            <CardContent className="p-0">
              <EntityList aria-label={t('apiKeys.revoked')}>
                {revoked.map((key) => (
                  <li key={key.id}>
                    <ApiKeyRow apiKey={key} onRevoke={onRevoke} />
                  </li>
                ))}
              </EntityList>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}
