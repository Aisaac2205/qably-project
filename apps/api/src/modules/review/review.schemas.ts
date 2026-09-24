import { z } from 'zod';
import { decodeInboxCursor } from './lib/inbox-cursor';

export const listProposalsQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  status: z
    .enum(['in_review', 'approved', 'rejected', 'changes_requested'])
    .optional(),
  duplicatesOnly: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export const decisionSchema = z.object({
  comment: z.string().trim().min(1).max(1000).optional(),
});

export const documentFilesBodySchema = z
  .object({
    mode: z
      .enum(['undocumented', 'stale-locale', 'incomplete'])
      .default('undocumented'),
  })
  .default({ mode: 'undocumented' });

export type DocumentFilesBody = z.infer<typeof documentFilesBodySchema>;

export const reviewInboxQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  status: z
    .enum(['in_review', 'approved', 'rejected', 'changes_requested'])
    .default('in_review'),
  duplicatesOnly: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  search: z.string().trim().min(1).max(200).optional(),
  cursor: z
    .string()
    .min(1)
    .optional()
    .refine(
      (value) => value === undefined || decodeInboxCursor(value) !== null,
      { message: 'cursor must be a valid opaque inbox cursor' },
    ),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const reviewInboxCountsQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export type ListProposalsQuery = z.infer<typeof listProposalsQuerySchema>;
export type DecisionBody = z.infer<typeof decisionSchema>;
export type ReviewInboxQuery = z.infer<typeof reviewInboxQuerySchema>;
export type ReviewInboxCountsQuery = z.infer<
  typeof reviewInboxCountsQuerySchema
>;
