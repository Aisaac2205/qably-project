import { describe, it, expect, beforeEach } from 'vitest'
import * as mockStore from '@/lib/mock-store'
import {
  __resetStore,
  getAiProviders,
  connectAiProvider,
  disconnectAiProvider,
  getChatThreads,
  getChatThread,
  createChatThread,
  deleteChatThread,
  getChatMessages,
  sendChatMessage,
  getCoverageGaps,
  getAiCases,
  approveProposal,
  getOfficialTestCase,
  getProposal,
  getProposalForAiReviewCase,
  getReviewScenario,
  getTestCaseVersions,
  getTraceabilityLinks,
  rejectProposal,
  getSnapshot,
} from '@/lib/mock-store'

describe('mock-store AI providers', () => {
  beforeEach(() => __resetStore())

  it('returns seeded providers', () => {
    const providers = getAiProviders()
    expect(providers.find((p) => p.provider === 'gemini')?.connected).toBe(true)
    expect(providers.find((p) => p.provider === 'claude')?.connected).toBe(false)
  })

  it('connects a provider and masks the key', () => {
    const connection = connectAiProvider('claude', 'sk-ant-SECRETKEY1234')
    expect(connection.connected).toBe(true)
    expect(connection.maskedKey).toBe('sk-ant...1234')
    expect(connection.maskedKey).not.toContain('SECRET')
  })

  it('disconnects a provider', () => {
    disconnectAiProvider('gemini')
    const connection = getAiProviders().find((p) => p.provider === 'gemini')
    expect(connection?.connected).toBe(false)
    expect(connection?.maskedKey).toBeUndefined()
  })
})

describe('mock-store project chat', () => {
  beforeEach(() => __resetStore())

  it('returns the seeded threads for proj-1 sorted by updatedAt', () => {
    const threads = getChatThreads('proj-1')
    expect(threads.length).toBeGreaterThan(0)
    expect(threads[0].projectId).toBe('proj-1')
    expect(getChatMessages(threads[0].id).length).toBe(2)
  })

  it('creates a unique thread on createChatThread', () => {
    const t1 = createChatThread('proj-1')
    const t2 = createChatThread('proj-1')
    expect(t1.id).not.toBe(t2.id)
    expect(getChatThreads('proj-1').map((t) => t.id)).toContain(t1.id)
    expect(getChatThreads('proj-1').map((t) => t.id)).toContain(t2.id)
  })

  it('creates a thread from the explicit send event for a project with no chat history', () => {
    expect(getChatThreads('proj-2').length).toBe(0)

    const { userMessage, thread } = sendChatMessage('proj-2', 'How many suites exist?')

    expect(thread.projectId).toBe('proj-2')
    expect(thread.id).toBe(userMessage.threadId)
    expect(getChatThreads('proj-2').length).toBe(1)
  })

  it('appends a user message and a generic assistant reply to an existing thread', () => {
    const initialThread = getChatThreads('proj-1')[0]
    const before = getChatMessages(initialThread.id).length
    const { userMessage, assistantMessage, thread } = sendChatMessage(
      'proj-1',
      'How many suites exist?',
      initialThread.id,
    )
    expect(thread.id).toBe(initialThread.id)
    expect(userMessage.role).toBe('user')
    expect(assistantMessage.role).toBe('assistant')
    expect(getChatMessages(initialThread.id).length).toBe(before + 2)
  })

  it('deletes a thread and all associated messages in cascade', () => {
    const initialThread = getChatThreads('proj-1')[0]
    expect(getChatMessages(initialThread.id).length).toBeGreaterThan(0)

    const deleted = deleteChatThread(initialThread.id)
    expect(deleted).toBe(true)
    expect(getChatThread(initialThread.id)).toBeUndefined()
    expect(getChatThreads('proj-1').find((t) => t.id === initialThread.id)).toBeUndefined()
    expect(getChatMessages(initialThread.id).length).toBe(0)
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

describe('mock-store governance surface', () => {
  it('does not export a mass-confirm mutation', () => {
    expect(mockStore).not.toHaveProperty('confirmAllPending')
  })
})

describe('mock-store governed proposal scenarios', () => {
  beforeEach(() => __resetStore())

  it('approves a new proposal atomically with decision, case, version, and links', () => {
    const scenario = getReviewScenario('approval-new')
    const proposal = getProposal(scenario.proposalId)!

    const result = approveProposal(proposal.id, { actorId: 'member-1', comment: 'Reviewed against the source.' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(getProposal(proposal.id)?.status).toBe('approved')
    expect(getOfficialTestCase(result.officialTestCase.id)).toEqual(result.officialTestCase)
    expect(getTestCaseVersions(result.officialTestCase.id)).toContainEqual(result.version)
    expect(getTraceabilityLinks({ entityId: proposal.id })).toHaveLength(2)
    expect(result.decision.action).toBe('approved')

    const snapshot = getSnapshot()
    expect(approveProposal(proposal.id, { actorId: 'member-1' })).toEqual({ ok: false, reason: 'invalid_transition' })
    expect(getSnapshot().officialTestCases).toEqual(snapshot.officialTestCases)
    expect(getSnapshot().reviewDecisions).toEqual(snapshot.reviewDecisions)
  })

  it('finds a proposal through the explicit AI review case association', () => {
    const proposal = getProposalForAiReviewCase('ai-2')

    expect(proposal?.id).toBe('review-proposal-checkout')
    expect(proposal?.id).not.toBe('proposal-ai-2')
  })

  it('approves a duplicate proposal as an immutable next version', () => {
    const scenario = getReviewScenario('approval-version')
    const result = approveProposal(scenario.proposalId, { actorId: 'member-1' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.createdNewCase).toBe(false)
    expect(result.version.version).toBe(2)
  })

  it('rejects only an in-review proposal and keeps its source evidence link', () => {
    const scenario = getReviewScenario('rejection-evidence')
    const result = rejectProposal(scenario.proposalId, { actorId: 'member-1', comment: 'Evidence does not cover this risk.' })

    expect(result.ok).toBe(true)
    expect(getProposal(scenario.proposalId)?.status).toBe('rejected')
    expect(getTraceabilityLinks({ entityId: scenario.proposalId })).toHaveLength(1)
    expect(rejectProposal(scenario.proposalId, { actorId: 'member-1' })).toEqual({ ok: false, reason: 'invalid_transition' })
  })

  it('resets the three deterministic review scenarios to identical seeded proposals', () => {
    const before = ['approval-new', 'approval-version', 'rejection-evidence'].map((id) => {
      const scenario = getReviewScenario(id as 'approval-new' | 'approval-version' | 'rejection-evidence')
      return { scenario, proposal: getProposal(scenario.proposalId) }
    })

    approveProposal('proposal-ai-4', { actorId: 'member-1' })
    rejectProposal('proposal-ai-3', { actorId: 'member-1' })
    __resetStore()

    expect(['approval-new', 'approval-version', 'rejection-evidence'].map((id) => {
      const scenario = getReviewScenario(id as 'approval-new' | 'approval-version' | 'rejection-evidence')
      return { scenario, proposal: getProposal(scenario.proposalId) }
    })).toEqual(before)
  })
})
