import { describe, it, expect } from 'vitest'
import { wantsCaseGeneration, buildAssistantReply } from '@/features/ai-review/lib/generate-mock-reply'

describe('wantsCaseGeneration', () => {
  it('detects Spanish generation intent', () => {
    expect(wantsCaseGeneration('Genera un caso para el checkout')).toBe(true)
    expect(wantsCaseGeneration('Crea un caso de prueba para login')).toBe(true)
  })

  it('detects English generation intent', () => {
    expect(wantsCaseGeneration('Please generate a case for password reset')).toBe(true)
    expect(wantsCaseGeneration('Create a test case for the API')).toBe(true)
  })

  it('returns false for plain questions', () => {
    expect(wantsCaseGeneration('How many suites are pending?')).toBe(false)
    expect(wantsCaseGeneration('')).toBe(false)
  })
})

describe('buildAssistantReply', () => {
  it('returns a generation confirmation when a case was generated', () => {
    const reply = buildAssistantReply({
      projectCaseCount: 5,
      pendingCount: 2,
      requestText: 'genera un caso',
      generatedCaseName: 'Case drafted from chat: genera un caso',
    })
    expect(reply).toContain('Case drafted from chat: genera un caso')
    expect(reply).toContain('review queue')
  })

  it('returns a stats summary when nothing was generated', () => {
    const reply = buildAssistantReply({ projectCaseCount: 5, pendingCount: 2, requestText: 'how many cases?' })
    expect(reply).toContain('5')
    expect(reply).toContain('2')
  })
})
