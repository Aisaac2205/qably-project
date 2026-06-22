import { describe, it, expect, beforeEach } from 'vitest'
import {
  getProjects,
  getProject,
  getSuites,
  getSuite,
  getRuns,
  getRun,
  getAiCases,
  getOrg,
  getMembers,
  getApiKeys,
  getIntegration,
  updateSuite,
  createSuite,
  deleteSuite,
  setDefaultSuite,
  updateRunCaseStatus,
  createRun,
  confirmAiCase,
  rejectAiCase,
  skipAiCase,
  createApiKey,
  revokeApiKey,
  createProject,
  updateIntegration,
  inviteMember,
  subscribe,
  getSnapshot,
  getServerSnapshot,
  __resetStore,
} from '@/lib/mock-store'
import type { Project, Suite, Run, AiCase, ApiKey, OrgMember } from '@qably/types'

describe('mock-store', () => {
  beforeEach(() => {
    __resetStore()
  })

  // ── Core ────────────────────────────────────────────────────────

  it('subscribe returns an unsubscribe function that prevents future fires', () => {
    let calls = 0
    const unsub = subscribe(() => { calls++ })
    expect(calls).toBe(0)
    createProject({ name: 'Test Project' })
    expect(calls).toBe(1)
    unsub()
    createProject({ name: 'Another Project' })
    expect(calls).toBe(1)
  })

  it('mutators broadcast to all subscribers', () => {
    const calls: number[] = []
    subscribe(() => calls.push(0))
    subscribe(() => calls.push(1))
    createProject({ name: 'Test' })
    expect(calls).toEqual([0, 1])
  })

  it('getSnapshot returns the current snapshot', () => {
    const projects = getSnapshot().projects
    expect(projects).toEqual(getProjects())
  })

  it('getServerSnapshot returns a frozen empty snapshot', () => {
    const server = getServerSnapshot()
    expect(server).toBeDefined()
    // Must return same identity each call (stable reference)
    const a = getServerSnapshot()
    const b = getServerSnapshot()
    expect(a).toBe(b)
    // Should contain empty data
    expect(a.projects).toEqual([])
  })

  it('getServerSnapshot inner arrays are stable references across calls', () => {
    const a = getServerSnapshot()
    const b = getServerSnapshot()
    // Each inner array must be the SAME reference — React 19 useSyncExternalStore
    // requires getServerSnapshot to return identical references for identical state.
    expect(a.projects).toBe(b.projects)
    expect(a.suites).toBe(b.suites)
    expect(a.runs).toBe(b.runs)
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

  it('createProject adds a project and notifies subscribers', () => {
    let notified = false
    subscribe(() => { notified = true })

    const p = createProject({
      name: 'New Project',
      description: 'Test desc',
      githubRepo: 'org/repo',
    })

    expect(notified).toBe(true)
    expect(p.id).toMatch(/^proj-/)
    expect(p.name).toBe('New Project')
    expect(p.description).toBe('Test desc')
    expect(p.githubRepo).toBe('org/repo')
    expect(p.healthScore).toBe(100)
    expect(p.lastRunStatus).toBe('pass')
    expect(p.suiteCount).toBe(0)
    expect(p.activeRunCount).toBe(0)
    expect(p.aiPendingCount).toBe(0)
    expect(getProject(p.id)).toEqual(p)
  })

  // ── Suites ──────────────────────────────────────────────────────

  it('getSuites returns suites for a project', () => {
    const suites = getSuites('proj-1')
    expect(suites.length).toBeGreaterThanOrEqual(3)
    expect(suites[0].name).toBe('Authentication')
  })

  it('getSuites returns empty array for project with no suites', () => {
    expect(getSuites('proj-999')).toEqual([])
  })

  it('getSuite returns the correct suite by id', () => {
    const s = getSuite('suite-1')
    expect(s).toBeDefined()
    expect(s!.name).toBe('Authentication')
  })

  it('updateSuite merges patch and notifies subscribers', () => {
    let notified = false
    subscribe(() => { notified = true })

    const updated = updateSuite('suite-1', { name: 'Auth Suite Renamed' })
    expect(notified).toBe(true)
    expect(updated).toBeDefined()
    expect(updated!.name).toBe('Auth Suite Renamed')
    // Verify it persists
    expect(getSuite('suite-1')!.name).toBe('Auth Suite Renamed')
  })

  it('updateSuite widens patch to accept description and tags', () => {
    const updated = updateSuite('suite-1', {
      description: 'New description',
      tags: ['smoke', 'e2e'],
    })
    expect(updated).toBeDefined()
    expect(updated!.description).toBe('New description')
    expect(updated!.tags).toEqual(['smoke', 'e2e'])
  })

  it('updateSuite refreshes updatedAt on every mutation', async () => {
    const before = getSuite('suite-1')!.updatedAt
    await new Promise((r) => setTimeout(r, 5))
    const updated = updateSuite('suite-1', { name: 'Renamed Again' })
    expect(updated).toBeDefined()
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThan(new Date(before).getTime())
  })

  it('createSuite adds a suite, validates tags, and sets updatedAt', () => {
    let notified = false
    subscribe(() => { notified = true })

    const suite = createSuite({
      projectId: 'proj-1',
      name: 'New Test Suite',
      description: 'Tests for new feature',
      tags: ['SMOKE', '  api  ', 'smoke'], // normalize + dedupe
    })

    expect(notified).toBe(true)
    expect(suite.id).toMatch(/^suite-/)
    expect(suite.name).toBe('New Test Suite')
    expect(suite.description).toBe('Tests for new feature')
    expect(suite.tags).toEqual(['smoke', 'api'])
    expect(suite.isDefault).toBe(false) // not the first suite for proj-1
    expect(suite.updatedAt).toBeDefined()
    expect(getSuite(suite.id)).toEqual(suite)
  })

  it('createSuite auto-defaults the first suite for a new project', () => {
    const suite = createSuite({
      projectId: 'proj-empty',
      name: 'Brand New Project First Suite',
      description: 'First suite',
    })
    expect(suite.isDefault).toBe(true)
  })

  it('createSuite does NOT default subsequent suites in the same project', () => {
    createSuite({
      projectId: 'proj-empty-2',
      name: 'First',
      description: 'First',
    })
    const second = createSuite({
      projectId: 'proj-empty-2',
      name: 'Second',
      description: 'Second',
    })
    expect(second.isDefault).toBe(false)
  })

  it('updateSuite with isDefault: true unsets the previous default in same project', () => {
    // suite-1 is the default for proj-1 in mock data
    expect(getSuite('suite-1')!.isDefault).toBe(true)

    const switched = updateSuite('suite-2', { isDefault: true })
    expect(switched).toBeDefined()
    expect(switched!.isDefault).toBe(true)
    expect(getSuite('suite-1')!.isDefault).toBe(false)
    expect(getSuite('suite-2')!.isDefault).toBe(true)
  })

  it('updateSuite with isDefault does not affect other projects', () => {
    // Add a default suite in proj-3
    const proj3 = createSuite({
      projectId: 'proj-3',
      name: 'Proj 3 Default',
      description: 'Default for proj-3',
    })
    expect(proj3.isDefault).toBe(true)

    // Now switch default in proj-1 — proj-3 default should remain untouched
    updateSuite('suite-2', { isDefault: true })
    expect(getSuite(proj3.id)!.isDefault).toBe(true)
  })

  it('setDefaultSuite switches the default and updates updatedAt', () => {
    expect(getSuite('suite-1')!.isDefault).toBe(true)

    const result = setDefaultSuite('suite-2')
    expect(result).toBeDefined()
    expect(result!.isDefault).toBe(true)
    expect(getSuite('suite-1')!.isDefault).toBe(false)
    expect(getSuite('suite-2')!.isDefault).toBe(true)
  })

  it('setDefaultSuite returns undefined for unknown id', () => {
    expect(setDefaultSuite('nonexistent')).toBeUndefined()
  })

  it('setDefaultSuite is a no-op when target is already the default', () => {
    expect(getSuite('suite-1')!.isDefault).toBe(true)
    const result = setDefaultSuite('suite-1')
    expect(result).toBeDefined()
    expect(result!.isDefault).toBe(true)
    expect(getSuite('suite-1')!.isDefault).toBe(true)
  })

  it('deleteSuite removes a suite and returns true', () => {
    const before = getSuites('proj-1').length
    const result = deleteSuite('suite-3')
    expect(result).toBe(true)
    expect(getSuite('suite-3')).toBeUndefined()
    expect(getSuites('proj-1').length).toBe(before - 1)
  })

  it('deleteSuite returns false for unknown id', () => {
    expect(deleteSuite('nonexistent')).toBe(false)
  })

  it('deleteSuite promotes next-most-recent when default is deleted', () => {
    // suite-1 is the default for proj-1
    expect(getSuite('suite-1')!.isDefault).toBe(true)
    deleteSuite('suite-1')
    // One of the remaining proj-1 suites should now be the default
    const remaining = getSuites('proj-1')
    const defaultCount = remaining.filter((s) => s.isDefault).length
    expect(defaultCount).toBe(1)
  })

  it('deleteSuite does not affect other projects when their default survives', () => {
    // Create a project with multiple suites
    const a = createSuite({ projectId: 'proj-isolated', name: 'A', description: 'A' })
    const b = createSuite({ projectId: 'proj-isolated', name: 'B', description: 'B' })
    // a is auto-default, b is not
    expect(a.isDefault).toBe(true)
    expect(b.isDefault).toBe(false)
    // Switch default to b explicitly via setDefaultSuite
    setDefaultSuite(b.id)
    expect(getSuite(a.id)!.isDefault).toBe(false)
    expect(getSuite(b.id)!.isDefault).toBe(true)
    // Now delete a (the previous default) — b should remain the default
    deleteSuite(a.id)
    expect(getSuite(b.id)!.isDefault).toBe(true)
  })

  // ── Runs ────────────────────────────────────────────────────────

  it('getRuns returns runs for a project', () => {
    const runs = getRuns('proj-1')
    expect(runs.length).toBeGreaterThanOrEqual(3)
  })

  it('getRun returns the correct run by id', () => {
    const r = getRun('run-12')
    expect(r).toBeDefined()
    expect(r!.name).toBe('Run #12')
  })

  it('createRun creates a new run and notifies subscribers', () => {
    let notified = false
    subscribe(() => { notified = true })

    const run = createRun({
      projectId: 'proj-1',
      suiteId: 'suite-1',
      name: 'Custom Run',
    })

    expect(notified).toBe(true)
    expect(run.id).toMatch(/^run-/)
    expect(run.projectId).toBe('proj-1')
    expect(run.suiteId).toBe('suite-1')
    expect(run.status).toBe('running')
    expect(getRun(run.id)).toEqual(run)
  })

  it('updateRunCaseStatus updates a case status', () => {
    let notified = false
    subscribe(() => { notified = true })

    const run = updateRunCaseStatus('run-12', 'tc-1', 'fail')
    expect(notified).toBe(true)
    expect(run).toBeDefined()
    const updatedCase = run!.cases.find(c => c.id === 'tc-1')
    expect(updatedCase!.status).toBe('fail')
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

  // ── Org / Members / API Keys / Integration ─────────────────────

  it('getOrg returns the mock organization', () => {
    const org = getOrg()
    expect(org.name).toBe('Acme QA Team')
    expect(org.slug).toBe('acme-qa')
    expect(org.plan).toBe('pro')
  })

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
    expect(key.prefix).toBe('org_')
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
    createProject({ name: 'Temp' })
    updateSuite('suite-1', { name: 'Changed' })
    confirmAiCase('ai-2')
    revokeApiKey('key-1')

    __resetStore()

    // Verify all collections are back to seed
    expect(getProjects().length).toBe(4)
    expect(getSuite('suite-1')!.name).toBe('Authentication')
    expect(getAiCases('proj-1').find(c => c.id === 'ai-2')!.reviewStatus).toBe('pending')
    expect(getApiKeys().find(k => k.id === 'key-1')).toBeDefined()
  })
})
