import { en, es, type Locale } from '@qably/i18n';
import type { NotificationEventType } from '@qably/types';

interface EventCatalog {
  notifications: {
    events: Record<string, string>;
    emailSubject: Record<string, string>;
  };
}

const dictionaries: Record<Locale, EventCatalog> = {
  en: en,
  es: es,
};

function interpolate(
  template: string,
  payload: Record<string, string | number>,
): string {
  return Object.entries(payload).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
}

export function renderNotificationMessage(
  locale: Locale,
  eventType: NotificationEventType,
  payload: Record<string, string | number>,
): string {
  const template = dictionaries[locale].notifications.events[eventType];

  if (template === undefined) return eventType;

  return interpolate(template, payload);
}

export function renderNotificationSubject(
  locale: Locale,
  eventType: NotificationEventType,
  payload: Record<string, string | number>,
): string {
  const template = dictionaries[locale].notifications.emailSubject[eventType];

  if (template === undefined) return eventType;

  return interpolate(template, payload);
}
