/**
 * In-memory pub-sub data store seeded from mock data.
 *
 * Phase 1 transitional layer. Replace with fetch-based calls in Phase 2.
 * React hooks use useSyncExternalStore — no Zustand needed in Phase 1.
 */
import {
  mockProjects,
  mockSuites,
  mockRuns,
  mockAiCases,
  mockOrg,
  mockMembers,
  mockApiKeys,
  mockGithubIntegration,
} from '@/lib/mock-data'
import type {
  Project,
  Suite,
  Run,
  AiCase,
  Organization,
  OrgMember,
  ApiKey,
  GithubIntegration,
  CaseStatus,
} from '@qably/types'

// ── Types ─────────────────────────────────────────────────────────

type Listener = () => void

export interface StoreSnapshot {
  projects: Project[]
  suites: Suite[]
  runs: Run[]
  aiCases: AiCase[]
  org: Organization
  members: OrgMember[]
  apiKeys: ApiKey[]
  integration: GithubIntegration
}

// ── State ─────────────────────────────────────────────────────────

let projects: Project[] = structuredClone(mockProjects)
let suites: Suite[] = structuredClone(mockSuites)
let runs: Run[] = structuredClone(mockRuns)
let aiCases: AiCase[] = structuredClone(mockAiCases)
let org: Organization = { ...mockOrg }
let members: OrgMember[] = structuredClone(mockMembers)
let apiKeys: ApiKey[] = structuredClone(mockApiKeys)
let integration: GithubIntegration = { ...mockGithubIntegration }

// ── Pub-sub ───────────────────────────────────────────────────────

const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((l) => l())
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function currentSnapshot(): StoreSnapshot {
  return { projects, suites, runs, aiCases, org, members, apiKeys, integration }
}

// Stable server snapshot — cached as a frozen constant
const FROZEN_EMPTY: StoreSnapshot = Object.freeze({
  projects: [],
  suites: [],
  runs: [],
  aiCases: [],
  org: { id: '', name: '', slug: '', plan: 'free' as const, planLimits: { maxProjects: 0, maxUsers: 0, maxCases: 0 } },
  members: [],
  apiKeys: [],
  integration: { webhookUrl: '', connected: false },
})

export function getSnapshot(): StoreSnapshot {
  return currentSnapshot()
}

export function getServerSnapshot(): StoreSnapshot {
  return FROZEN_EMPTY
}

// ── Readers ───────────────────────────────────────────────────────

export function getProjects(): Project[] {
  return projects
}

export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id)
}

export function getSuites(projectId?: string): Suite[] {
  if (!projectId) return suites
  return suites.filter((s) => s.projectId === projectId)
}

export function getSuite(suiteId: string): Suite | undefined {
  return suites.find((s) => s.id === suiteId)
}

export function getRuns(projectId?: string): Run[] {
  if (!projectId) return runs
  return runs.filter((r) => r.projectId === projectId)
}

export function getRun(runId: string): Run | undefined {
  return runs.find((r) => r.id === runId)
}

export function getAiCases(projectId?: string): AiCase[] {
  if (!projectId) return aiCases
  return aiCases.filter((c) => c.projectId === projectId)
}

export function getOrg(): Organization {
  return org
}

export function getMembers(): OrgMember[] {
  return members
}

export function getApiKeys(): ApiKey[] {
  return apiKeys
}

export function getIntegration(): GithubIntegration {
  return integration
}

// ── Mutators ──────────────────────────────────────────────────────

export function updateSuite(id: string, patch: Partial<Pick<Suite, 'name'>>): Suite | undefined {
  suites = suites.map((s) => (s.id === id ? { ...s, ...patch } : s))
  notify()
  return suites.find((s) => s.id === id)
}

export function updateRunCaseStatus(runId: string, caseId: string, status: CaseStatus): Run | undefined {
  runs = runs.map((r) => {
    if (r.id !== runId) return r
    const updatedCases = r.cases.map((c) => (c.id === caseId ? { ...c, status } : c))
    return { ...r, cases: updatedCases }
  })
  notify()
  return runs.find((r) => r.id === runId)
}

export function createRun(input: {
  projectId: string
  suiteId: string
  name?: string
}): Run {
  const existing = runs.filter((r) => r.projectId === input.projectId)
  const id = `run-${existing.length + 13}`
  const suite = suites.find((s) => s.id === input.suiteId)
  const newRun: Run = {
    id,
    projectId: input.projectId,
    name: input.name ?? `Run #${existing.length + 13}`,
    suiteId: input.suiteId,
    suiteName: suite?.name ?? '',
    status: 'running',
    passRate: 0,
    source: 'manual',
    startedAt: new Date().toISOString(),
    cases: [],
  }
  runs = [...runs, newRun]
  notify()
  return newRun
}

export function confirmAiCase(id: string): AiCase | undefined {
  aiCases = aiCases.map((c) => (c.id === id ? { ...c, reviewStatus: 'confirmed' as const } : c))
  notify()
  return aiCases.find((c) => c.id === id)
}

export function rejectAiCase(id: string): AiCase | undefined {
  aiCases = aiCases.map((c) => (c.id === id ? { ...c, reviewStatus: 'rejected' as const } : c))
  notify()
  return aiCases.find((c) => c.id === id)
}

export function skipAiCase(id: string): AiCase | undefined {
  // No-op: already pending, return as-is
  return aiCases.find((c) => c.id === id)
}

export function createApiKey(name: string): ApiKey {
  const id = `key-${apiKeys.length + 1}`
  const lastFour = Math.random().toString(16).slice(2, 6)
  const newKey: ApiKey = {
    id,
    name,
    prefix: 'org_',
    lastFour,
    createdAt: new Date().toISOString(),
  }
  apiKeys = [...apiKeys, newKey]
  notify()
  return newKey
}

export function revokeApiKey(id: string): boolean {
  const before = apiKeys.length
  apiKeys = apiKeys.filter((k) => k.id !== id)
  if (apiKeys.length !== before) {
    notify()
    return true
  }
  return false
}

export function updateProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'description' | 'githubRepo' | 'technologies'>>,
): Project | undefined {
  projects = projects.map((p) => (p.id === id ? { ...p, ...patch } : p))
  notify()
  return projects.find((p) => p.id === id)
}

export function createProject(input: {
  name: string
  description?: string
  githubRepo?: string
  technologies?: string[]
}): Project {
  const id = `proj-${projects.length + 1}`
  const newProject: Project = {
    id,
    name: input.name,
    description: input.description ?? '',
    githubRepo: input.githubRepo ?? '',
    organizationId: 'org-1',
    healthScore: 100,
    lastRunStatus: 'pass',
    lastRunAt: new Date().toISOString(),
    suiteCount: 0,
    activeRunCount: 0,
    aiPendingCount: 0,
    createdAt: new Date().toISOString(),
    technologies: input.technologies ?? [],
  }
  projects = [...projects, newProject]
  notify()
  return newProject
}

export function updateIntegration(patch: Partial<GithubIntegration>): GithubIntegration {
  integration = { ...integration, ...patch }
  notify()
  return integration
}

export function inviteMember(input: { email: string; role: OrgMember['role'] }): OrgMember {
  const id = `member-${members.length + 1}`
  const newMember: OrgMember = {
    id,
    userId: `user-${members.length + 1}`,
    name: input.email.split('@')[0],
    email: input.email,
    role: input.role,
    joinedAt: new Date().toISOString(),
  }
  members = [...members, newMember]
  notify()
  return newMember
}

// ── Test-only reset ───────────────────────────────────────────────

export function __resetStore(): void {
  projects = structuredClone(mockProjects)
  suites = structuredClone(mockSuites)
  runs = structuredClone(mockRuns)
  aiCases = structuredClone(mockAiCases)
  org = { ...mockOrg }
  members = structuredClone(mockMembers)
  apiKeys = structuredClone(mockApiKeys)
  integration = { ...mockGithubIntegration }
  notify()
}
