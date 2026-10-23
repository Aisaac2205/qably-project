import type { ThreadMessageLike } from '@assistant-ui/react'
import type {
  AttachedCaseRecord,
  ChatMessageRecord,
  GroundingView,
  SuggestedCaseRecord,
} from '@qably/types'
import type { PendingMessage } from '@/features/projects/test-generation/hooks/use-project-chat'

export const ATTACHED_CASES_PART = 'attached-cases'
export const SUGGESTED_CASES_PART = 'suggested-cases'

export const PENDING_MESSAGE_ID = 'aeris-pending-question'
export const STREAMING_MESSAGE_ID = 'aeris-streaming-reply'

export interface SuggestedCasesPartData {
  threadId: string
  messageId: string
  suggestedCases: SuggestedCaseRecord[]
  sentProposalIds?: Record<number, string>
  /** Cases attached to the question this reply answers, to name the case a proposal updates. */
  attachedCases?: AttachedCaseRecord[]
}

export interface AerisMessageCustomMetadata {
  grounding: GroundingView | null
}

/**
 * What the assistant-ui runtime renders: the stored thread, the optimistic
 * question while it is in flight, and the reply as it streams.
 */
export type AerisRuntimeMessage =
  | { kind: 'record'; record: ChatMessageRecord; precedingAttachedCases?: AttachedCaseRecord[] }
  | { kind: 'pending'; content: string; attachedCases: AttachedCaseRecord[] }
  | { kind: 'streaming'; text: string }

export function buildRuntimeMessages({
  messages,
  pendingMessage,
  streamingText,
  isRunning,
}: {
  messages: ChatMessageRecord[]
  pendingMessage: PendingMessage | null
  streamingText: string
  isRunning: boolean
}): AerisRuntimeMessage[] {
  let precedingAttachedCases: AttachedCaseRecord[] | undefined
  const runtimeMessages: AerisRuntimeMessage[] = messages.map((record) => {
    if (record.role === 'user') {
      precedingAttachedCases = record.attachedCases
      return { kind: 'record', record }
    }
    return { kind: 'record', record, precedingAttachedCases }
  })

  if (pendingMessage?.content) {
    runtimeMessages.push({
      kind: 'pending',
      content: pendingMessage.content,
      attachedCases: pendingMessage.attachedCases ?? [],
    })
  }

  if (isRunning) {
    runtimeMessages.push({ kind: 'streaming', text: streamingText })
  }

  return runtimeMessages
}

function userContent(text: string, attachedCases: AttachedCaseRecord[] = []): ThreadMessageLike['content'] {
  return [
    ...(attachedCases.length > 0
      ? [{ type: `data-${ATTACHED_CASES_PART}` as const, data: attachedCases }]
      : []),
    { type: 'text' as const, text },
  ]
}

export function convertAerisMessage(message: AerisRuntimeMessage): ThreadMessageLike {
  if (message.kind === 'pending') {
    return {
      id: PENDING_MESSAGE_ID,
      role: 'user',
      content: userContent(message.content, message.attachedCases),
    }
  }

  if (message.kind === 'streaming') {
    return {
      id: STREAMING_MESSAGE_ID,
      role: 'assistant',
      status: { type: 'running' },
      content: message.text === '' ? [] : [{ type: 'text', text: message.text }],
    }
  }

  const { record } = message
  const createdAt = new Date(record.createdAt)

  if (record.role === 'user') {
    return {
      id: record.id,
      role: 'user',
      createdAt,
      content: userContent(record.content, record.attachedCases),
    }
  }

  const suggestedCases: SuggestedCasesPartData | null =
    record.suggestedCases.length > 0
      ? {
          threadId: record.threadId,
          messageId: record.id,
          suggestedCases: record.suggestedCases,
          sentProposalIds: record.sentProposalIds,
          attachedCases: message.precedingAttachedCases,
        }
      : null
  const custom: AerisMessageCustomMetadata = { grounding: record.grounding ?? null }

  return {
    id: record.id,
    role: 'assistant',
    createdAt,
    status: { type: 'complete', reason: 'stop' },
    content: [
      { type: 'text', text: record.content },
      ...(suggestedCases === null
        ? []
        : [{ type: `data-${SUGGESTED_CASES_PART}` as const, data: suggestedCases }]),
    ],
    metadata: { custom: { ...custom } },
  }
}
