import { z } from 'zod';

export const updateMyLocaleSchema = z.object({
  locale: z.enum(['en', 'es']),
});

export type UpdateMyLocaleInput = z.infer<typeof updateMyLocaleSchema>;
