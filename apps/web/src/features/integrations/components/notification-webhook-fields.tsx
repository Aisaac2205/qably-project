'use client'

import type { NotificationEventType, NotificationWebhookType } from '@qably/types'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@qably/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/lib/i18n'

/**
 * Presentational fields shared by the create and edit notification webhook
 * dialogs. Each dialog owns its own state and validation flow and composes
 * these pieces, so the two forms cannot drift apart.
 */

export const MAX_WEBHOOK_NAME_LENGTH = 80

export const NOTIFICATION_WEBHOOK_LOGO: Record<NotificationWebhookType, string> = {
  slack: '/logos/slack.svg',
  discord: '/logos/discord.svg',
}

export const NOTIFICATION_EVENT_TYPES = Object.keys(
  DEFAULT_NOTIFICATION_PREFERENCES,
) as NotificationEventType[]

/** Returns the i18n key of the first problem with a trimmed name, or undefined when valid. */
export function webhookNameErrorKey(trimmedName: string): string | undefined {
  if (!trimmedName) return 'settings.webhooks.nameRequired'
  if (trimmedName.length > MAX_WEBHOOK_NAME_LENGTH) return 'settings.webhooks.nameTooLong'
  return undefined
}

/** Returns the i18n key when no event is selected, or undefined when valid. */
export function webhookEventTypesErrorKey(
  eventTypes: readonly NotificationEventType[],
): string | undefined {
  return eventTypes.length === 0 ? 'settings.webhooks.eventTypesRequired' : undefined
}

export function toggleWebhookEventType(
  current: NotificationEventType[],
  eventType: NotificationEventType,
  checked: boolean,
): NotificationEventType[] {
  return checked
    ? [...current, eventType]
    : current.filter((value) => value !== eventType)
}

interface WebhookNameFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  invalid: boolean
  disabled: boolean
  describedBy?: string
}

export function WebhookNameField({
  id,
  value,
  onChange,
  invalid,
  disabled,
  describedBy,
}: WebhookNameFieldProps) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t('settings.webhooks.nameLabel')}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('settings.webhooks.namePlaceholder')}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoFocus
        disabled={disabled}
      />
    </div>
  )
}

interface WebhookEventTypesFieldsetProps {
  idPrefix: string
  value: readonly NotificationEventType[]
  onToggle: (eventType: NotificationEventType, checked: boolean) => void
  disabled: boolean
}

export function WebhookEventTypesFieldset({
  idPrefix,
  value,
  onToggle,
  disabled,
}: WebhookEventTypesFieldsetProps) {
  const { t } = useTranslation()

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium text-foreground">
        {t('settings.webhooks.eventTypesLabel')}
      </legend>
      <div className="grid gap-2">
        {NOTIFICATION_EVENT_TYPES.map((eventType) => {
          const id = `${idPrefix}-${eventType}`
          return (
            <div key={eventType} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={value.includes(eventType)}
                disabled={disabled}
                onCheckedChange={(next) => onToggle(eventType, next === true)}
              />
              <Label htmlFor={id} className="font-normal">
                {t(`settings.notifications.events.${eventType}`)}
              </Label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
