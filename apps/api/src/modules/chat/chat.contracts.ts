import { z } from 'zod';
import { extractedCaseSchema } from '../ai/extraction.contracts';

export const CHAT_PROMPT_VERSION = 'chat-v1';
export const MAX_SUGGESTED_CASES = 5;
export const MAX_HISTORY_MESSAGES = 20;
export const MAX_REPLY_LENGTH = 4000;
export const MAX_EXCERPT_LENGTH = 600;

export const suggestedCaseSchema = extractedCaseSchema.omit({
  automationKey: true,
  sourceExcerpt: true,
});

export const suggestedCasesSchema = z
  .array(suggestedCaseSchema)
  .max(MAX_SUGGESTED_CASES);

export type SuggestedCase = z.infer<typeof suggestedCaseSchema>;

export type ChatRole = 'user' | 'assistant';

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
  createdAt: string;
}

export interface ChatThreadDetailView extends ChatThreadView {
  messages: ChatMessageView[];
}

export interface SendToReviewView {
  proposalId: string;
}

export type ChatError =
  | 'project-not-found'
  | 'thread-not-found'
  | 'message-not-found'
  | 'case-not-found'
  | 'missing-suite'
  | 'provider-unavailable';

export const CHAT_ASSISTANT = Symbol('CHAT_ASSISTANT');
