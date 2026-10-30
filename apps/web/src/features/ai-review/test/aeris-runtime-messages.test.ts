import { describe, expect, it } from 'vitest'
import type { AttachedCaseRecord, SuggestedCaseRecord } from '@qably/types'
import {
  PENDING_MESSAGE_ID,
  STREAMING_MESSAGE_ID,
  buildRuntimeMessages,
  convertAerisMessage,
} from '@/features/ai-review/lib/aeris-runtime-messages'
import { assistantRecord, userRecord } from './chat-test-harness'

const attachedCase: AttachedCaseRecord = {
  id: 'tc-1',
  name: 'Valid login redirects to dashboard',
  suiteName: 'Authentication',
}

const suggestedCase: SuggestedCaseRecord = {
  title: 'Valid login lands on the dashboard',
  objective: 'Verify login',
  preconditions: [],
  steps: ['Log in'],
  expectedResult: 'Dashboard is shown',
  priority: 'high',
  targetTestCaseId: 'tc-1',
}

describe('buildRuntimeMessages', () => {
  it('pairs each reply with the cases attached to the question before it', () => {
    const messages = buildRuntimeMessages({
      messages: [
        userRecord('m1', 'Improve this', { attachedCases: [attachedCase] }),
        assistantRecord('m2', 'Done'),
        userRecord('m3', 'And now?'),
        assistantRecord('m4', 'Nothing attached'),
      ],
      pendingMessage: null,
      streamingText: '',
      streamingCases: [],
      isRunning: false,
    })

    expect(messages).toMatchObject([
      { kind: 'record' },
      { kind: 'record', precedingAttachedCases: [attachedCase] },
      { kind: 'record' },
      { kind: 'record', precedingAttachedCases: undefined },
    ])
  })

  it('adds the optimistic question and the streaming reply while a send is running', () => {
    const messages = buildRuntimeMessages({
      messages: [],
      pendingMessage: { content: 'Question', status: 'sending', attachedCases: [attachedCase] },
      streamingText: 'Partial',
      streamingCases: [],
      isRunning: true,
    })

    expect(messages).toEqual([
      { kind: 'pending', content: 'Question', attachedCases: [attachedCase] },
      { kind: 'streaming', text: 'Partial', cases: [] },
    ])
  })

  it('carries the cases streamed so far on the in-flight reply', () => {
    const messages = buildRuntimeMessages({
      messages: [],
      pendingMessage: { content: 'Question', status: 'sending' },
      streamingText: 'Here is one:',
      streamingCases: [suggestedCase],
      isRunning: true,
    })

    expect(messages).toEqual([
      { kind: 'pending', content: 'Question', attachedCases: [] },
      { kind: 'streaming', text: 'Here is one:', cases: [suggestedCase] },
    ])
  })

  it('keeps a failed question visible but adds no reply once nothing is running', () => {
    expect(
      buildRuntimeMessages({
        messages: [],
        pendingMessage: { content: 'Question', status: 'error', errorKind: 'throttled' },
        streamingText: '',
        streamingCases: [],
        isRunning: false,
      }),
    ).toEqual([{ kind: 'pending', content: 'Question', attachedCases: [] }])
  })

  it('adds no question for an unavailable notice, whose question the server stored', () => {
    expect(
      buildRuntimeMessages({
        messages: [],
        pendingMessage: { status: 'unavailable', errorKind: 'provider-unavailable' },
        streamingText: '',
        streamingCases: [],
        isRunning: false,
      }),
    ).toEqual([])
  })
})

describe('convertAerisMessage', () => {
  it('puts the attached cases of a question in a data part ahead of its text', () => {
    expect(
      convertAerisMessage({
        kind: 'record',
        record: userRecord('m1', 'Improve this', { attachedCases: [attachedCase] }),
      }),
    ).toMatchObject({
      id: 'm1',
      role: 'user',
      content: [
        { type: 'data-attached-cases', data: [attachedCase] },
        { type: 'text', text: 'Improve this' },
      ],
    })
  })

  it('sends a plain question as text only', () => {
    expect(convertAerisMessage({ kind: 'record', record: userRecord('m1', 'Hello') }).content).toEqual([
      { type: 'text', text: 'Hello' },
    ])
  })

  it('carries the suggested cases and the grounding of a stored reply', () => {
    const converted = convertAerisMessage({
      kind: 'record',
      record: assistantRecord('m2', 'Here it is', {
        suggestedCases: [suggestedCase],
        sentProposalIds: { 0: 'proposal-1' },
        grounding: { status: 'insufficient' },
      }),
      precedingAttachedCases: [attachedCase],
    })

    expect(converted).toMatchObject({
      id: 'm2',
      role: 'assistant',
      status: { type: 'complete', reason: 'stop' },
      content: [
        { type: 'text', text: 'Here it is' },
        {
          type: 'data-suggested-cases',
          data: {
            threadId: 'thread-1',
            messageId: 'm2',
            suggestedCases: [suggestedCase],
            sentProposalIds: { 0: 'proposal-1' },
            attachedCases: [attachedCase],
          },
        },
      ],
      metadata: { custom: { grounding: { status: 'insufficient' } } },
    })
  })

  it('adds no suggested-cases part to a reply without suggestions', () => {
    expect(convertAerisMessage({ kind: 'record', record: assistantRecord('m2', 'Plain') }).content).toEqual([
      { type: 'text', text: 'Plain' },
    ])
  })

  it('marks the streaming reply as running and leaves it empty until text arrives', () => {
    expect(convertAerisMessage({ kind: 'streaming', text: '', cases: [] })).toEqual({
      id: STREAMING_MESSAGE_ID,
      role: 'assistant',
      status: { type: 'running' },
      content: [],
    })
    expect(convertAerisMessage({ kind: 'streaming', text: 'Par', cases: [] }).content).toEqual([
      { type: 'text', text: 'Par' },
    ])
  })

  it('adds a streaming-cases data part for each case that has arrived so far', () => {
    expect(
      convertAerisMessage({ kind: 'streaming', text: 'Here:', cases: [suggestedCase] }).content,
    ).toEqual([
      { type: 'text', text: 'Here:' },
      { type: 'data-streaming-cases', data: [suggestedCase] },
    ])
  })

  it('adds no streaming-cases part before any case has arrived', () => {
    expect(convertAerisMessage({ kind: 'streaming', text: '', cases: [] }).content).toEqual([])
  })

  it('gives the optimistic question a stable id', () => {
    expect(convertAerisMessage({ kind: 'pending', content: 'Question', attachedCases: [] })).toMatchObject({
      id: PENDING_MESSAGE_ID,
      role: 'user',
      content: [{ type: 'text', text: 'Question' }],
    })
  })
})
