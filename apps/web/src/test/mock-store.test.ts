import { describe, it, expect, beforeEach } from 'vitest'
import {
  getProjects,
  getProject,
  getSuites,
  getSuite,
  getRuns,
  getRun,
  getAiCases,
  getPipelines,
  getOrg,
  getMembers,
  getApiKeys,
  getIntegration,
  updateSuite,
  updateRunCaseStatus,
  createRun,
  confirmAiCase,
  rejectAiCase,
  skipAiCase,
  createApiKey,
  revokeApiKey,
  createProject,
  createPipeline,
  updateIntegration,
  inviteMember,
  subscribe,
  getSnapshot,
  getServerSnapshot,
  __resetStore,
} from '@/lib/mock-store'
import type { Project, Suite, Run, AiCase, ApiKey, OrgMember, PipelineRun } from '@qably/types'

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

  // ── Pipelines ───────────────────────────────────────────────────

  it('getPipelines returns pipelines for a project', () => {
    const pipes = getPipelines('proj-1')
    expect(pipes.length).toBeGreaterThanOrEqual(2)
  })

  it('createPipeline creates a new pipeline and notifies', () => {
    let notified = false
    subscribe(() => { notified = true })

    const pipe = createPipeline({
      projectId: 'proj-1',
      branch: 'feature/x',
      commitSha: 'abc1234',
      commitMessage: 'test: add pipeline',
    })

    expect(notified).toBe(true)
    expect(pipe.id).toMatch(/^pipe-/)
    expect(pipe.branch).toBe('feature/x')
    expect(pipe.status).toBe('running')
    expect(getPipelines('proj-1').find(p => p.id === pipe.id)).toEqual(pipe)
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
