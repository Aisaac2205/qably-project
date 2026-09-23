import { en, es, resolveNotificationEventKey, type Locale } from '@qably/i18n';
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

function resolveTemplateKey(
  eventType: NotificationEventType,
  payload: Record<string, string | number>,
): string {
  if (eventType === 'connection_security') {
    return resolveNotificationEventKey(eventType, payload);
  }

  const count = payload.count;

  if (typeof count !== 'number') return eventType;

  if (eventType === 'run_completed' || eventType === 'run_failed') {
    return `${eventType}_${count === 1 ? 'one' : 'other'}`;
  }

  return eventType;
}

export function renderNotificationMessage(
  locale: Locale,
  eventType: NotificationEventType,
  payload: Record<string, string | number>,
): string {
  const catalog = dictionaries[locale].notifications.events;
  const template =
    catalog[resolveTemplateKey(eventType, payload)] ?? catalog[eventType];

  if (template === undefined) return eventType;

  return interpolate(template, payload);
}

export function renderNotificationSubject(
  locale: Locale,
  eventType: NotificationEventType,
  payload: Record<string, string | number>,
): string {
  const catalog = dictionaries[locale].notifications.emailSubject;
  const template =
    catalog[resolveTemplateKey(eventType, payload)] ?? catalog[eventType];

  if (template === undefined) return eventType;

  return interpolate(template, payload);
}
