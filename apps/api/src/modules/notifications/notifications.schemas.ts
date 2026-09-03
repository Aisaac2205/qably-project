import { z } from 'zod';

const notificationEventType = z.enum([
  'run_failed',
  'run_completed',
  'case_regressed',
  'ingestion_failed',
  'connection_security',
]);

const notificationChannel = z.enum(['in_app', 'email']);

export const updatePreferencesSchema = z.object({
  locale: z.enum(['en', 'es']).optional(),
  preferences: z.array(
    z.object({
      eventType: notificationEventType,
      channel: notificationChannel,
      enabled: z.boolean(),
    }),
  ),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
