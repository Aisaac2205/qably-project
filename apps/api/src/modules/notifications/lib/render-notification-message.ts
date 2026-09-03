import { en, es, type Locale } from '@qably/i18n';
import type { NotificationEventType } from '@qably/types';

interface EventCatalog {
  notifications: { events: Record<string, string> };
}

const dictionaries: Record<Locale, EventCatalog> = {
  en: en,
  es: es,
};

export function renderNotificationMessage(
  locale: Locale,
  eventType: NotificationEventType,
  payload: Record<string, string | number>,
): string {
  const template = dictionaries[locale].notifications.events[eventType];

  if (template === undefined) return eventType;

  return Object.entries(payload).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
}
