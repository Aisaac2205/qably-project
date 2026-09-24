import { z } from 'zod';

export const createInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['admin', 'member']),
});

export const tokenSchema = z.object({
  token: z.string().min(1),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type TokenInput = z.infer<typeof tokenSchema>;
