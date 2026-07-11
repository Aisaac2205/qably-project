import { describe, it, expect, beforeEach } from 'vitest'
import {
  __resetStore,
  getAiProviders,
  connectAiProvider,
  disconnectAiProvider,
  getChatThread,
  getChatMessages,
  sendChatMessage,
  getCoverageGaps,
  getAiCases,
  confirmAllPending,
} from '@/lib/mock-store'

describe('mock-store AI providers', () => {
  beforeEach(() => __resetStore())

  it('returns seeded providers', () => {
    const providers = getAiProviders()
    expect(providers.find((p) => p.provider === 'claude')?.connected).toBe(true)
    expect(providers.find((p) => p.provider === 'gemini')?.connected).toBe(false)
  })

  it('connects a provider and masks the key', () => {
    const connection = connectAiProvider('gemini', 'AIzaSySECRETKEY1234')
    expect(connection.connected).toBe(true)
    expect(connection.maskedKey).toBe('AIzaSy...1234')
    expect(connection.maskedKey).not.toContain('SECRET')
  })

  it('disconnects a provider', () => {
    disconnectAiProvider('claude')
    const connection = getAiProviders().find((p) => p.provider === 'claude')
    expect(connection?.connected).toBe(false)
    expect(connection?.maskedKey).toBeUndefined()
  })
})

describe('mock-store project chat', () => {
  beforeEach(() => __resetStore())

  it('returns the seeded thread for proj-1', () => {
    const thread = getChatThread('proj-1')
    expect(thread.projectId).toBe('proj-1')
    expect(getChatMessages(thread.id).length).toBe(2)
  })

  it('creates a thread lazily for a project with no chat history', () => {
    const thread = getChatThread('proj-2')
    expect(thread.projectId).toBe('proj-2')
    expect(getChatMessages(thread.id)).toEqual([])
  })

  it('appends a user message and a generic assistant reply', () => {
    const before = getChatMessages(getChatThread('proj-1').id).length
    const { userMessage, assistantMessage } = sendChatMessage('proj-1', 'How many suites exist?')
    expect(userMessage.role).toBe('user')
    expect(assistantMessage.role).toBe('assistant')
    expect(getChatMessages(userMessage.threadId).length).toBe(before + 2)
  })

  it('creates a draft AiCase when the message asks to generate a case', () => {
    const casesBefore = getAiCases('proj-1').length
    const { assistantMessage } = sendChatMessage('proj-1', 'Genera un caso de prueba para el login con 2FA')
    expect(assistantMessage.generatedCaseIds?.length).toBe(1)
    const cases = getAiCases('proj-1')
    expect(cases.length).toBe(casesBefore + 1)
    const created = cases.find((c) => c.id === assistantMessage.generatedCaseIds?.[0])
    expect(created?.source).toBe('chat')
    expect(created?.reviewStatus).toBe('pending')
  })
})

describe('mock-store coverage gaps', () => {
  beforeEach(() => __resetStore())

  it('returns gaps for a project', () => {
    expect(getCoverageGaps('proj-1').length).toBe(2)
  })

  it('returns an empty array for a project with no gaps', () => {
    expect(getCoverageGaps('proj-2')).toEqual([])
  })
})

describe('mock-store confirmAllPending', () => {
  beforeEach(() => __resetStore())

  it('confirms every pending AiCase for a project and leaves others untouched', () => {
    confirmAllPending('proj-1')
    const cases = getAiCases('proj-1')
    expect(cases.every((c) => c.reviewStatus !== 'pending')).toBe(true)
    expect(cases.find((c) => c.id === 'ai-1')?.reviewStatus).toBe('confirmed')
  })
})
