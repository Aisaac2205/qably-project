import { z } from 'zod';

const name = z.string().trim().min(1).max(80);
const repo = z
  .string()
  .trim()
  .regex(/^[\w.-]+\/[\w.-]+$/, 'must be in owner/repository form');
const provider = z.enum(['GITHUB', 'BITBUCKET']);
const token = z.string().trim().min(1).max(500);

export const createConnectionSchema = z.object({
  provider,
  name,
  repo,
  token,
});

export const updateConnectionSchema = z
  .object({
    name: name.optional(),
    token: token.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'provide at least one field to update',
  });

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;
export type UpdateConnectionInput = z.infer<typeof updateConnectionSchema>;
