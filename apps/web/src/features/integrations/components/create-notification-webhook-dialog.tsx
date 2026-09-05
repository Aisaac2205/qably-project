'use client'

import { useState, type FormEvent } from 'react'
import type { NotificationEventType, NotificationWebhookType } from '@qably/types'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@qably/types'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n'

const MAX_NAME_LENGTH = 80

const EVENT_TYPES = Object.keys(
  DEFAULT_NOTIFICATION_PREFERENCES,
) as NotificationEventType[]

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
    setEventTypes((current) =>
      checked
        ? [...current, eventType]
        : current.filter((value) => value !== eventType),
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedUrl = url.trim()

    if (!trimmedName) {
      setValidationError(t('settings.webhooks.nameRequired'))
      return
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      setValidationError(t('settings.webhooks.nameTooLong'))
      return
    }
    if (!trimmedUrl) {
      setValidationError(t('settings.webhooks.urlRequired'))
      return
    }
    if (eventTypes.length === 0) {
      setValidationError(t('settings.webhooks.eventTypesRequired'))
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
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slack">{t('settings.webhooks.typeSlack')}</SelectItem>
              <SelectItem value="discord">{t('settings.webhooks.typeDiscord')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="webhook-name">{t('settings.webhooks.nameLabel')}</Label>
          <Input
            id="webhook-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (validationError) setValidationError('')
            }}
            placeholder={t('settings.webhooks.namePlaceholder')}
            aria-invalid={Boolean(displayedError)}
            autoFocus
            disabled={isSubmitting}
          />
        </div>

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

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-foreground">
            {t('settings.webhooks.eventTypesLabel')}
          </legend>
          <div className="grid gap-2">
            {EVENT_TYPES.map((eventType) => {
              const checked = eventTypes.includes(eventType)
              const label = t(`settings.notifications.events.${eventType}`)
              return (
                <div key={eventType} className="flex items-center gap-2">
                  <Checkbox
                    id={`webhook-event-${eventType}`}
                    checked={checked}
                    disabled={isSubmitting}
                    onCheckedChange={(next) => toggleEventType(eventType, next === true)}
                  />
                  <Label htmlFor={`webhook-event-${eventType}`} className="font-normal">
                    {label}
                  </Label>
                </div>
              )
            })}
          </div>
        </fieldset>

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
