import { z } from 'zod';
import type { NotificationWebhookType } from '@qably/types';

const ALLOWED_HOSTS: Record<NotificationWebhookType, string[]> = {
  slack: ['hooks.slack.com'],
  discord: ['discord.com', 'discordapp.com'],
};

function hasAllowedHost(type: NotificationWebhookType, url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' && ALLOWED_HOSTS[type].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

const type = z.enum(['slack', 'discord']);
const name = z.string().trim().min(1).max(80);
const eventType = z.enum([
  'run_failed',
  'run_completed',
  'case_regressed',
  'ingestion_failed',
  'connection_security',
]);
const eventTypes = z.array(eventType).min(1);

export const createNotificationWebhookSchema = z
  .object({ type, name, url: z.url(), eventTypes })
  .refine((value) => hasAllowedHost(value.type, value.url), {
    message:
      'webhook url must be a hooks.slack.com, discord.com or discordapp.com https endpoint',
    path: ['url'],
  });

export const updateNotificationWebhookSchema = z
  .object({
    name: name.optional(),
    enabled: z.boolean().optional(),
    eventTypes: eventTypes.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'provide at least one field to update',
  });

export type CreateNotificationWebhookInput = z.infer<
  typeof createNotificationWebhookSchema
>;
export type UpdateNotificationWebhookInput = z.infer<
  typeof updateNotificationWebhookSchema
>;
