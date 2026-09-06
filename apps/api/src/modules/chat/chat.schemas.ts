import { z } from 'zod';

export const createThreadSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export const sendToReviewSchema = z.object({
  caseIndex: z.number().int().min(0).max(4),
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SendToReviewInput = z.infer<typeof sendToReviewSchema>;
