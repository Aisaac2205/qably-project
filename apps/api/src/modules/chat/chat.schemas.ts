import { z } from 'zod';
import { MAX_ATTACHED_CASES } from '@qably/types';

export { MAX_ATTACHED_CASES };

export const createThreadSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

const attachedCaseIdsSchema = z
  .array(z.string().cuid())
  .min(1)
  .max(MAX_ATTACHED_CASES)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'caseIds must not contain duplicates',
  });

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  caseIds: attachedCaseIdsSchema.optional(),
});

export const sendToReviewSchema = z.object({
  caseIndex: z.number().int().min(0).max(4),
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SendToReviewInput = z.infer<typeof sendToReviewSchema>;
