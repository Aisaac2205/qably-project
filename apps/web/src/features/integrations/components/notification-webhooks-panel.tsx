'use client'

import { useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import type { NotificationWebhook } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { useCurrentOrganization } from '@/features/organizations/hooks/use-current-organization'
import {
  useCreateNotificationWebhook,
  useDeleteNotificationWebhook,
  useTestNotificationWebhook,
  useUpdateNotificationWebhook,
} from '../hooks/use-notification-webhook-mutations'
import { useNotificationWebhooks } from '../hooks/use-notification-webhooks'
import { CreateNotificationWebhookDialog } from './create-notification-webhook-dialog'
import { NotificationWebhookRow } from './notification-webhook-row'

export function NotificationWebhooksPanel() {
  const { t } = useTranslation()
  const { organization } = useCurrentOrganization()
  const canWrite = organization?.role === 'owner' || organization?.role === 'admin'

  const { webhooks, isLoading, isError } = useNotificationWebhooks()
  const createMutation = useCreateNotificationWebhook()
  const updateMutation = useUpdateNotificationWebhook()
  const deleteMutation = useDeleteNotificationWebhook()
  const testMutation = useTestNotificationWebhook()

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<NotificationWebhook | undefined>(
    undefined,
  )

  function handleCreate(input: Parameters<typeof createMutation.mutate>[0]) {
    createMutation.mutate(input, { onSuccess: () => setCreateOpen(false) })
  }

  return (
    <section className="space-y-5" aria-labelledby="notification-webhooks-heading">
      <header className="flex flex-wrap items-start justify-between gap-4 pb-1">
        <div className="space-y-0.5">
          <h2 id="notification-webhooks-heading" className="text-sm font-semibold text-default">
            {t('settings.webhooks.title')}
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            {t('settings.webhooks.description')}
          </p>
        </div>

        {canWrite && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} weight="bold" aria-hidden="true" />
            {t('settings.webhooks.addAction')}
          </Button>
        )}
      </header>

      {isLoading ? (
        <StateView kind="loading" title={t('common.loading')} />
      ) : isError ? (
        <StateView kind="error" title={t('settings.webhooks.loadError')} />
      ) : webhooks.length === 0 ? (
        <StateView
          kind="empty"
          title={t('settings.webhooks.emptyTitle')}
          description={
            canWrite
              ? t('settings.webhooks.emptyDescription')
              : t('settings.webhooks.emptyDescriptionReadOnly')
          }
        />
      ) : (
        <Card className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <CardContent className="p-0">
            <EntityList aria-label={t('settings.webhooks.title')}>
              {webhooks.map((webhook) => (
                <li key={webhook.id}>
                  <NotificationWebhookRow
                    webhook={webhook}
                    canWrite={canWrite}
                    onToggleEnabled={(target, enabled) =>
                      updateMutation.mutate({ id: target.id, payload: { enabled } })
                    }
                    onDelete={(target) => setDeleteTarget(target)}
                    onTest={(target) => testMutation.mutateAsync(target.id)}
                  />
                </li>
              ))}
            </EntityList>
          </CardContent>
        </Card>
      )}

      <CreateNotificationWebhookDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
        error={createMutation.isError ? t('settings.webhooks.createError') : undefined}
      />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined)
        }}
        title={t('settings.webhooks.deleteTitle', { name: deleteTarget?.name ?? '' })}
        description={t('settings.webhooks.deleteDescription')}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
      />
    </section>
  )
}
