'use client'

import type {
  NotificationChannel,
  NotificationEventType,
} from '@qably/types'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@qably/types'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from '@/lib/i18n'
import { useNotificationPreferences } from '../hooks/use-notification-preferences'
import type { NotificationPreferenceView } from '../api/notifications.api'

const CHANNELS: NotificationChannel[] = ['in_app', 'email']

const EVENT_TYPES = Object.keys(
  DEFAULT_NOTIFICATION_PREFERENCES,
) as NotificationEventType[]

const GROUPS: {
  key: string
  titleKey: string
  descriptionKey: string
  events: NotificationEventType[]
}[] = [
  {
    key: 'runs',
    titleKey: 'settings.notifications.groups.runs.title',
    descriptionKey: 'settings.notifications.groups.runs.description',
    events: ['run_failed', 'run_completed', 'case_regressed'],
  },
  {
    key: 'ingestion',
    titleKey: 'settings.notifications.groups.ingestion.title',
    descriptionKey: 'settings.notifications.groups.ingestion.description',
    events: ['ingestion_failed'],
  },
  {
    key: 'security',
    titleKey: 'settings.notifications.groups.security.title',
    descriptionKey: 'settings.notifications.groups.security.description',
    events: ['connection_security'],
  },
]

const CHANNEL_LABEL_KEY: Record<NotificationChannel, string> = {
  in_app: 'settings.notifications.columnInApp',
  email: 'settings.notifications.columnEmail',
  slack: 'settings.webhooks.typeSlack',
  discord: 'settings.webhooks.typeDiscord',
}

function resolveEnabled(
  preferences: NotificationPreferenceView[],
  eventType: NotificationEventType,
  channel: NotificationChannel,
): boolean {
  const row = preferences.find(
    (preference) => preference.eventType === eventType && preference.channel === channel,
  )
  return row?.enabled ?? DEFAULT_NOTIFICATION_PREFERENCES[eventType][channel]
}

export function NotificationPreferencesPanel() {
  const { t } = useTranslation()
  const { preferences, updatePreferences, isSaving } = useNotificationPreferences()

  const allOff = EVENT_TYPES.every((eventType) =>
    CHANNELS.every((channel) => !resolveEnabled(preferences, eventType, channel)),
  )

  function handleCellChange(
    eventType: NotificationEventType,
    channel: NotificationChannel,
    enabled: boolean,
  ) {
    void updatePreferences({ preferences: [{ eventType, channel, enabled }] })
  }

  function handleGlobalToggle(nextOff: boolean) {
    const rows = EVENT_TYPES.flatMap((eventType) =>
      CHANNELS.map((channel) => ({
        eventType,
        channel,
        enabled: nextOff ? false : DEFAULT_NOTIFICATION_PREFERENCES[eventType][channel],
      })),
    )
    void updatePreferences({ preferences: rows })
  }

  return (
    <section
      className="space-y-5"
      aria-labelledby="notification-preferences-heading"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 pb-1">
        <div className="space-y-0.5">
          <h2
            id="notification-preferences-heading"
            className="text-sm font-semibold text-default"
          >
            {t('settings.notifications.title')}
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            {t('settings.notifications.description')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 text-xs font-medium text-default">
          <span id="notifications-turn-off-label">{t('settings.notifications.turnAllOff')}</span>
          <Switch
            aria-labelledby="notifications-turn-off-label"
            checked={allOff}
            disabled={isSaving}
            onCheckedChange={handleGlobalToggle}
          />
        </div>
      </header>

      {GROUPS.map((group) => (
        <Card key={group.key} className="p-5 shadow-none">
          <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_1fr]">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-default">{t(group.titleKey)}</h3>
              <p className="text-xs text-muted-foreground">{t(group.descriptionKey)}</p>
            </div>

            <table className="w-full border-collapse">
              <caption className="sr-only">{t(group.titleKey)}</caption>
              <thead>
                <tr className="border-b border-border/70">
                  <th scope="col" className="py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('settings.notifications.columnEvent')}
                  </th>
                  {CHANNELS.map((channel) => (
                    <th
                      key={channel}
                      scope="col"
                      className="w-20 py-2 text-center text-xs font-medium text-muted-foreground"
                    >
                      {t(CHANNEL_LABEL_KEY[channel])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.events.map((eventType) => {
                  const eventLabel = t(`settings.notifications.events.${eventType}`)
                  return (
                    <tr key={eventType} className="border-b border-border/40 last:border-b-0">
                      <th
                        scope="row"
                        className="py-2.5 text-left text-sm font-normal text-default"
                      >
                        {eventLabel}
                      </th>
                      {CHANNELS.map((channel) => {
                        const checked = resolveEnabled(preferences, eventType, channel)
                        const channelLabel = t(CHANNEL_LABEL_KEY[channel])
                        return (
                          <td key={channel} className="py-2.5 text-center">
                            <Checkbox
                              aria-label={`${eventLabel}, ${channelLabel}`}
                              checked={checked}
                              disabled={isSaving}
                              onCheckedChange={(next) =>
                                handleCellChange(eventType, channel, next === true)
                              }
                              className="mx-auto"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </section>
  )
}
