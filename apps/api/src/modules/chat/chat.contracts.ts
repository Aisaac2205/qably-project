import { z } from 'zod';
import type { GroundingView } from '@qably/types';
import { extractedCaseObjectSchema } from '../ai/extraction.contracts';
import { isSafeEvidencePath } from './chat-evidence-path';

export const CHAT_PROMPT_VERSION = 'chat-v8';
export const MAX_SUGGESTED_CASES = 5;
export const MAX_HISTORY_MESSAGES = 20;
export const MAX_REPLY_LENGTH = 4000;
export const MAX_EXCERPT_LENGTH = 600;
export const MAX_GROUNDING_REFERENCES = 10;

export const suggestedCaseSchema = extractedCaseObjectSchema
  .omit({
    automationKey: true,
    sourceExcerpt: true,
  })
  .extend({
    targetTestCaseId: z.string().trim().min(1).optional(),
    // An unsafe path is dropped rather than failing the case: the case stays,
    // gated on evidence exactly as if the assistant had proposed no path.
    evidencePath: z
      .string()
      .trim()
      .refine(isSafeEvidencePath)
      .optional()
      .catch(undefined),
  });

export const suggestedCasesSchema = z
  .array(suggestedCaseSchema)
  .max(MAX_SUGGESTED_CASES);

export type SuggestedCase = z.infer<typeof suggestedCaseSchema>;

export type ChatRole = 'user' | 'assistant';

export interface AttachedCaseView {
  id: string;
  name: string;
  suiteName: string;
}

export interface ChatThreadView {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageView {
  id: string;
  threadId: string;
  role: ChatRole;
  content: string;
  suggestedCases: SuggestedCase[];
  attachedCases: AttachedCaseView[];
  grounding: GroundingView | null;
  createdAt: string;
  sentProposalIds?: Record<number, string>;
}

export interface ChatThreadDetailView extends ChatThreadView {
  messages: ChatMessageView[];
}

export interface SendToReviewView {
  proposalId: string;
  alreadySent?: boolean;
}

export type ChatError =
  | 'project-not-found'
  | 'thread-not-found'
  | 'message-not-found'
  | 'case-not-found'
  | 'missing-suite'
  | 'provider-unavailable'
  | 'ai-not-enabled'
  | 'quota-exhausted'
  | 'invalid-suggested-cases'
  | 'human-documented'
  | 'too-many-cases'
  | 'no-code-evidence'
  | 'file-unreadable';

/**
 * What a streamed send produces: reply text deltas and case previews, in any
 * order, then either the stored messages or the failure. A `failed` with no
 * delta or case before it happened before any reply text existed. A
 * previewed case is always one of `done.assistantMessage.suggestedCases`, at
 * the same index.
 */
export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'case'; index: number; case: SuggestedCase }
  | {
      type: 'done';
      userMessage: ChatMessageView;
      assistantMessage: ChatMessageView;
    }
  | { type: 'failed'; error: ChatError };

export const CHAT_ASSISTANT = Symbol('CHAT_ASSISTANT');
