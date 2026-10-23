'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import type { NotificationEventType, NotificationWebhookType } from '@qably/types'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n'
import {
  NOTIFICATION_WEBHOOK_LOGO,
  WebhookEventTypesFieldset,
  WebhookNameField,
  toggleWebhookEventType,
  webhookEventTypesErrorKey,
  webhookNameErrorKey,
} from './notification-webhook-fields'

interface CreateNotificationWebhookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: {
    type: NotificationWebhookType
    name: string
    url: string
    eventTypes: NotificationEventType[]
  }) => void
  isSubmitting: boolean
  error?: string
}

export function CreateNotificationWebhookDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
}: CreateNotificationWebhookDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CreateNotificationWebhookDialogContent
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          error={error}
        />
      )}
    </Dialog>
  )
}

function CreateNotificationWebhookDialogContent({
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
}: Omit<CreateNotificationWebhookDialogProps, 'open'>) {
  const { t } = useTranslation()
  const [type, setType] = useState<NotificationWebhookType>('slack')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [eventTypes, setEventTypes] = useState<NotificationEventType[]>(['run_failed'])
  const [validationError, setValidationError] = useState('')

  function toggleEventType(eventType: NotificationEventType, checked: boolean) {
    setEventTypes((current) => toggleWebhookEventType(current, eventType, checked))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedUrl = url.trim()

    const nameErrorKey = webhookNameErrorKey(trimmedName)
    if (nameErrorKey) {
      setValidationError(t(nameErrorKey))
      return
    }
    if (!trimmedUrl) {
      setValidationError(t('settings.webhooks.urlRequired'))
      return
    }
    const eventTypesErrorKey = webhookEventTypesErrorKey(eventTypes)
    if (eventTypesErrorKey) {
      setValidationError(t(eventTypesErrorKey))
      return
    }

    setValidationError('')
    onSubmit({ type, name: trimmedName, url: trimmedUrl, eventTypes })
  }

  const displayedError = validationError || error

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{t('settings.webhooks.createTitle')}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="webhook-type">{t('settings.webhooks.typeLabel')}</Label>
          <Select
            value={type}
            items={[
              { value: 'slack', label: t('settings.webhooks.typeSlack') },
              { value: 'discord', label: t('settings.webhooks.typeDiscord') },
            ]}
            onValueChange={(value) => setType(value as NotificationWebhookType)}
          >
            <SelectTrigger id="webhook-type" disabled={isSubmitting}>
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  <Image
                    src={NOTIFICATION_WEBHOOK_LOGO[type]}
                    alt=""
                    width={16}
                    height={16}
                    className="size-4 shrink-0"
                  />
                  <span>{t(`settings.webhooks.type${type === 'slack' ? 'Slack' : 'Discord'}`)}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slack">
                <Image src={NOTIFICATION_WEBHOOK_LOGO.slack} alt="" width={16} height={16} className="size-4 shrink-0" />
                <span>{t('settings.webhooks.typeSlack')}</span>
              </SelectItem>
              <SelectItem value="discord">
                <Image src={NOTIFICATION_WEBHOOK_LOGO.discord} alt="" width={16} height={16} className="size-4 shrink-0" />
                <span>{t('settings.webhooks.typeDiscord')}</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <WebhookNameField
          id="webhook-name"
          value={name}
          onChange={(value) => {
            setName(value)
            if (validationError) setValidationError('')
          }}
          invalid={Boolean(displayedError)}
          disabled={isSubmitting}
        />

        <div className="grid gap-2">
          <Label htmlFor="webhook-url">{t('settings.webhooks.urlLabel')}</Label>
          <Input
            id="webhook-url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value)
              if (validationError) setValidationError('')
            }}
            placeholder={
              type === 'slack'
                ? 'https://hooks.slack.com/services/…'
                : 'https://discord.com/api/webhooks/…'
            }
            aria-invalid={Boolean(displayedError)}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted">{t('settings.webhooks.urlHint')}</p>
        </div>

        <WebhookEventTypesFieldset
          idPrefix="webhook-event"
          value={eventTypes}
          onToggle={toggleEventType}
          disabled={isSubmitting}
        />

        {displayedError && (
          <p role="alert" className="text-xs text-fail">
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('settings.webhooks.creating') : t('settings.webhooks.create')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
