import { z } from 'zod';

export const setAccessTokenSchema = z.object({
  token: z.string().trim().min(1).max(500),
});

export type SetAccessTokenInput = z.infer<typeof setAccessTokenSchema>;
