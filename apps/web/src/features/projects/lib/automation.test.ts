/**
 * generateAutomation — transactional operation on a test case.
 *
 * Contract:
 * - Returns `undefined` for a missing testCaseId.
 * - On success, returns `{ caseId, projectId, code, generatedAt }`.
 * - Emits `case.confirmed` on the bus with `{ projectId, caseId }`.
 * - The generated code is a deterministic Playwright template for the demo
 *   (REQ-PROJ-007 + REQ-PROJ-008 will swap this for real AI generation).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateAutomation } from './automation'
import { __resetStore, getAiCases } from '@/lib/mock-store'
import { eventBus } from '@/lib/event-bus'

type EmitterInternals = { emitter: { removeAllListeners(): void } }

describe('generateAutomation — happy path', () => {
  beforeEach(() => {
    __resetStore()
    const internals = eventBus as unknown as EmitterInternals
    internals.emitter.removeAllListeners()
  })

  it('returns a result for the first mock AiCase', () => {
    const first = getAiCases()[0]
    expect(first).toBeDefined()

    const result = generateAutomation(first.id)
    expect(result).toBeDefined()
    expect(result?.caseId).toBe(first.id)
    expect(result?.projectId).toBe(first.projectId)
  })

  it('generated code is a Playwright template referencing the case name', () => {
    const first = getAiCases()[0]
    const result = generateAutomation(first.id)
    expect(result?.code).toContain("from '@playwright/test'")
    expect(result?.code).toContain(`test('${first.name}'`)
    expect(result?.code).toContain('page.goto')
  })

  it('generatedAt is an ISO string', () => {
    const first = getAiCases()[0]
    const result = generateAutomation(first.id)
    expect(result?.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})

describe('generateAutomation — events', () => {
  beforeEach(() => {
    __resetStore()
    const internals = eventBus as unknown as EmitterInternals
    internals.emitter.removeAllListeners()
  })

  it('emits case.confirmed with the projectId and caseId', () => {
    const listener = vi.fn()
    eventBus.on('case.confirmed', listener)

    const first = getAiCases()[0]
    generateAutomation(first.id)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({
      projectId: first.projectId,
      caseId: first.id,
    })
  })
})

describe('generateAutomation — missing case', () => {
  beforeEach(() => {
    __resetStore()
    const internals = eventBus as unknown as EmitterInternals
    internals.emitter.removeAllListeners()
  })

  it('returns undefined and emits nothing for a missing id', () => {
    const listener = vi.fn()
    eventBus.on('case.confirmed', listener)

    const result = generateAutomation('does-not-exist')
    expect(result).toBeUndefined()
    expect(listener).not.toHaveBeenCalled()
  })
})
