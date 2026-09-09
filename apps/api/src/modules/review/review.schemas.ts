import { z } from 'zod';

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
    mode: z.enum(['undocumented', 'stale-locale']).default('undocumented'),
  })
  .default({ mode: 'undocumented' });

export type DocumentFilesBody = z.infer<typeof documentFilesBodySchema>;

export const bulkDecisionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export type ListProposalsQuery = z.infer<typeof listProposalsQuerySchema>;
export type DecisionBody = z.infer<typeof decisionSchema>;
export type BulkDecisionBody = z.infer<typeof bulkDecisionSchema>;
