'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import type { NotificationEventType, NotificationWebhook } from '@qably/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import {
  NOTIFICATION_WEBHOOK_LOGO,
  WebhookEventTypesFieldset,
  WebhookNameField,
  toggleWebhookEventType,
  webhookEventTypesErrorKey,
  webhookNameErrorKey,
} from './notification-webhook-fields'

const NAME_ID = 'edit-webhook-name'
const ERROR_ID = 'edit-webhook-error'

interface EditNotificationWebhookDialogProps {
  /** The webhook being edited; the dialog is open while one is set. */
  webhook: NotificationWebhook | undefined
  onOpenChange: (open: boolean) => void
  onSubmit: (input: { name: string; eventTypes: NotificationEventType[] }) => void
  isSubmitting: boolean
  error?: string
}

type ValidationError = { field: 'name' | 'eventTypes'; message: string }

export function EditNotificationWebhookDialog({
  webhook,
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
}: EditNotificationWebhookDialogProps) {
  return (
    <Dialog open={webhook !== undefined} onOpenChange={onOpenChange}>
      {webhook && (
        <EditNotificationWebhookDialogContent
          key={webhook.id}
          webhook={webhook}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          error={error}
        />
      )}
    </Dialog>
  )
}

function hasSameEventTypes(
  a: readonly NotificationEventType[],
  b: readonly NotificationEventType[],
): boolean {
  return a.length === b.length && a.every((eventType) => b.includes(eventType))
}

function EditNotificationWebhookDialogContent({
  webhook,
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
}: Omit<EditNotificationWebhookDialogProps, 'webhook'> & { webhook: NotificationWebhook }) {
  const { t } = useTranslation()
  const [name, setName] = useState(webhook.name)
  const [eventTypes, setEventTypes] = useState<NotificationEventType[]>(webhook.eventTypes)
  const [validationError, setValidationError] = useState<ValidationError | undefined>(undefined)

  const trimmedName = name.trim()
  const hasChanges =
    trimmedName !== webhook.name || !hasSameEventTypes(eventTypes, webhook.eventTypes)
  const typeLabel = t(
    webhook.type === 'slack' ? 'settings.webhooks.typeSlack' : 'settings.webhooks.typeDiscord',
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const nameErrorKey = webhookNameErrorKey(trimmedName)
    if (nameErrorKey) {
      setValidationError({ field: 'name', message: t(nameErrorKey) })
      return
    }
    const eventTypesErrorKey = webhookEventTypesErrorKey(eventTypes)
    if (eventTypesErrorKey) {
      setValidationError({ field: 'eventTypes', message: t(eventTypesErrorKey) })
      return
    }

    setValidationError(undefined)
    onSubmit({ name: trimmedName, eventTypes })
  }

  const displayedError = validationError?.message || error
  const nameInvalid = validationError?.field === 'name'

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{t('settings.webhooks.editTitle')}</DialogTitle>
        <DialogDescription>{t('settings.webhooks.editDescription')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <dl className="grid gap-4">
          <div className="grid gap-2">
            <dt className="text-sm font-medium leading-none text-foreground">
              {t('settings.webhooks.typeLabel')}
            </dt>
            <dd className="flex items-center gap-1.5 text-sm text-muted">
              <Image
                src={NOTIFICATION_WEBHOOK_LOGO[webhook.type]}
                alt=""
                width={16}
                height={16}
                className="size-4 shrink-0"
              />
              <span>{typeLabel}</span>
            </dd>
          </div>
          <div className="grid gap-2">
            <dt className="text-sm font-medium leading-none text-foreground">
              {t('settings.webhooks.urlLabel')}
            </dt>
            <dd className="font-mono text-xs break-all text-muted">{webhook.maskedUrl}</dd>
          </div>
        </dl>

        <WebhookNameField
          id={NAME_ID}
          value={name}
          onChange={(value) => {
            setName(value)
            if (validationError) setValidationError(undefined)
          }}
          invalid={nameInvalid}
          describedBy={nameInvalid ? ERROR_ID : undefined}
          disabled={isSubmitting}
        />

        <WebhookEventTypesFieldset
          idPrefix="edit-webhook-event"
          value={eventTypes}
          onToggle={(eventType, checked) => {
            setEventTypes((current) => toggleWebhookEventType(current, eventType, checked))
            if (validationError) setValidationError(undefined)
          }}
          disabled={isSubmitting}
        />

        {displayedError && (
          <p id={ERROR_ID} role="alert" className="text-xs text-fail">
            {displayedError}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting || !hasChanges}>
            {isSubmitting ? t('settings.webhooks.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
