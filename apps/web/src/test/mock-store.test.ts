import { describe, it, expect, beforeEach } from 'vitest'
import {
  getProjects,
  getProject,
  getAiCases,
  getMembers,
  getApiKeys,
  getIntegration,
  confirmAiCase,
  rejectAiCase,
  skipAiCase,
  createApiKey,
  revokeApiKey,
  updateIntegration,
  inviteMember,
  subscribe,
  getSnapshot,
  getServerSnapshot,
  __resetStore,
} from '@/lib/mock-store'

describe('mock-store', () => {
  beforeEach(() => {
    __resetStore()
  })

  // ── Core ────────────────────────────────────────────────────────

  it('subscribe synchronizes immediately and unsubscribe prevents future fires', () => {
    let calls = 0
    const unsub = subscribe(() => { calls++ })
    expect(calls).toBe(1)
    confirmAiCase('ai-1')
    expect(calls).toBe(2)
    unsub()
    confirmAiCase('ai-3')
    expect(calls).toBe(2)
  })

  it('mutators broadcast to all subscribers', () => {
    const calls: number[] = []
    subscribe(() => calls.push(0))
    subscribe(() => calls.push(1))
    calls.length = 0
    confirmAiCase('ai-1')
    expect(calls).toEqual([0, 1])
  })

  it('getSnapshot returns the current snapshot', () => {
    const projects = getSnapshot().projects
    expect(projects).toEqual(getProjects())
  })

  it('getServerSnapshot returns a frozen seeded snapshot', () => {
    const server = getServerSnapshot()
    expect(server).toBeDefined()
    // Must return same identity each call (stable reference)
    const a = getServerSnapshot()
    const b = getServerSnapshot()
    expect(a).toBe(b)
    // SSR markup must match the browser's seeded initial state.
    expect(a.projects).toEqual(getProjects())
  })

  it('getServerSnapshot inner arrays are stable references across calls', () => {
    const a = getServerSnapshot()
    const b = getServerSnapshot()
    // Each inner array must be the SAME reference — React 19 useSyncExternalStore
    // requires getServerSnapshot to return identical references for identical state.
    expect(a.projects).toBe(b.projects)
    expect(a.aiCases).toBe(b.aiCases)
    expect(a.members).toBe(b.members)
    expect(a.apiKeys).toBe(b.apiKeys)
  })

  // ── Projects ────────────────────────────────────────────────────

  it('getProjects returns all seeded projects', () => {
    const projects = getProjects()
    expect(projects.length).toBeGreaterThanOrEqual(4)
    expect(projects[0].id).toBe('proj-1')
  })

  it('getProject returns the correct project by id', () => {
    const p = getProject('proj-1')
    expect(p).toBeDefined()
    expect(p!.name).toBe('Ecommerce App')
  })

  it('getProject returns undefined for unknown id', () => {
    expect(getProject('nonexistent')).toBeUndefined()
  })

  // ── AI Cases ────────────────────────────────────────────────────

  it('getAiCases returns AI cases for a project', () => {
    const cases = getAiCases('proj-1')
    expect(cases.length).toBeGreaterThanOrEqual(3)
  })

  it('confirmAiCase sets reviewStatus to confirmed', () => {
    let notified = false
    subscribe(() => { notified = true })

    const result = confirmAiCase('ai-2')
    expect(notified).toBe(true)
    expect(result!.reviewStatus).toBe('confirmed')
    const updated = getAiCases('proj-1').find(c => c.id === 'ai-2')
    expect(updated!.reviewStatus).toBe('confirmed')
  })

  it('rejectAiCase sets reviewStatus to rejected', () => {
    const result = rejectAiCase('ai-3')
    expect(result!.reviewStatus).toBe('rejected')
  })

  it('skipAiCase resolves as a no-op', () => {
    const result = skipAiCase('ai-2')
    expect(result).toBeDefined()
    expect(result!.reviewStatus).toBe('pending')
  })

  // ── Members / API Keys / Integration ────────────────────────────

  it('getMembers returns all members', () => {
    const members = getMembers()
    expect(members.length).toBeGreaterThanOrEqual(3)
  })

  it('getApiKeys returns all API keys', () => {
    const keys = getApiKeys()
    expect(keys.length).toBeGreaterThanOrEqual(2)
  })

  it('getIntegration returns the github integration', () => {
    const integration = getIntegration()
    expect(integration.connected).toBe(true)
  })

  it('createApiKey creates a key and notifies', () => {
    let notified = false
    subscribe(() => { notified = true })

    const key = createApiKey('New Pipeline Key')
    expect(notified).toBe(true)
    expect(key.id).toMatch(/^key-/)
    expect(key.name).toBe('New Pipeline Key')
    expect(key.prefix).toMatch(/^qbly_[0-9a-f]+$/)
    expect(key.projectId).toBe('proj-1')
    expect(key.lastFour).toBeDefined()
    expect(key.lastFour.length).toBe(4)
  })

  it('revokeApiKey removes the key and notifies', () => {
    let notified = false
    subscribe(() => { notified = true })

    const result = revokeApiKey('key-1')
    expect(notified).toBe(true)
    expect(result).toBe(true)
    expect(getApiKeys().find(k => k.id === 'key-1')).toBeUndefined()
  })

  it('updateIntegration merges patch and notifies', () => {
    let notified = false
    subscribe(() => { notified = true })

    const updated = updateIntegration({ connected: false, repoUrl: 'https://github.com/org/new-repo' })
    expect(notified).toBe(true)
    expect(updated.connected).toBe(false)
    expect(updated.repoUrl).toBe('https://github.com/org/new-repo')
  })

  it('inviteMember creates a member and notifies', () => {
    let notified = false
    subscribe(() => { notified = true })

    const member = inviteMember({ email: 'new@test.com', role: 'member' })
    expect(notified).toBe(true)
    expect(member.id).toMatch(/^member-/)
    expect(member.email).toBe('new@test.com')
    expect(member.role).toBe('member')
    expect(member.joinedAt).toBeDefined()
  })

  // ── Reset ───────────────────────────────────────────────────────

  it('__resetStore restores the seed data', () => {
    confirmAiCase('ai-2')
    revokeApiKey('key-1')

    __resetStore()

    // Verify all collections are back to seed
    expect(getProjects().length).toBe(4)
    expect(getAiCases('proj-1').find(c => c.id === 'ai-2')!.reviewStatus).toBe('pending')
    expect(getApiKeys().find(k => k.id === 'key-1')).toBeDefined()
  })
})
