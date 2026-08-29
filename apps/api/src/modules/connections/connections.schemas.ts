import { z } from 'zod';

const name = z.string().trim().min(1).max(80);
const repo = z
  .string()
  .trim()
  .regex(/^[\w.-]+\/[\w.-]+$/, 'must be in owner/repository form');
const provider = z.enum(['GITHUB', 'BITBUCKET']);

export const createConnectionSchema = z.object({
  provider,
  name,
  repo,
});

export const updateConnectionSchema = z
  .object({
    name: name.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'provide at least one field to update',
  });

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;
export type UpdateConnectionInput = z.infer<typeof updateConnectionSchema>;
