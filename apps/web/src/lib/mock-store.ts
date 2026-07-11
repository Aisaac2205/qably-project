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
  mockAiProviders,
  mockChatThreads,
  mockChatMessages,
  mockCoverageGaps,
} from '@/lib/mock-data'
import { validateTags } from '@/lib/tag-validation'
import { wantsCaseGeneration, buildAssistantReply } from '@/features/ai-review/lib/generate-mock-reply'
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
  AiProvider,
  AiProviderConnection,
  ChatThread,
  ChatMessage,
  CoverageGap,
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
  aiProviders: AiProviderConnection[]
  chatThreads: ChatThread[]
  chatMessages: ChatMessage[]
  coverageGaps: CoverageGap[]
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
let aiProviders: AiProviderConnection[] = structuredClone(mockAiProviders)
let chatThreads: ChatThread[] = structuredClone(mockChatThreads)
let chatMessages: ChatMessage[] = structuredClone(mockChatMessages)
let coverageGaps: CoverageGap[] = structuredClone(mockCoverageGaps)

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
  return {
    projects, suites, runs, aiCases, org, members, apiKeys, integration,
    aiProviders, chatThreads, chatMessages, coverageGaps,
  }
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
  aiProviders: [],
  chatThreads: [],
  chatMessages: [],
  coverageGaps: [],
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

export function getAiProviders(): AiProviderConnection[] {
  return aiProviders
}

export function getChatThread(projectId: string): ChatThread {
  const existing = chatThreads.find((t) => t.projectId === projectId)
  if (existing) return existing
  const ts = nowIso()
  const newThread: ChatThread = { id: `thread-${projectId}`, projectId, createdAt: ts, updatedAt: ts }
  chatThreads = [...chatThreads, newThread]
  notify()
  return newThread
}

export function getChatMessages(threadId: string): ChatMessage[] {
  return chatMessages.filter((m) => m.threadId === threadId)
}

export function getCoverageGaps(projectId?: string): CoverageGap[] {
  if (!projectId) return coverageGaps
  return coverageGaps.filter((g) => g.projectId === projectId)
}

// ── Mutators ──────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString()
}

export function createSuite(input: {
  projectId: string
  organizationId?: string
  name: string
  description: string
  tags?: string[]
}): Suite {
  const id = `suite-${suites.length + 1}`
  const tags = validateTags(input.tags ?? [])
  // First suite for a project auto-defaults to isDefault: true.
  const projectSuiteCount = suites.filter((s) => s.projectId === input.projectId).length
  const isDefault = projectSuiteCount === 0
  const createdAt = nowIso()
  const newSuite: Suite = {
    id,
    projectId: input.projectId,
    organizationId: input.organizationId ?? 'org-1',
    name: input.name,
    cases: [],
    createdAt,
    description: input.description,
    tags,
    isDefault,
    updatedAt: createdAt,
  }
  suites = [...suites, newSuite]
  notify()
  return newSuite
}

export function updateSuite(
  id: string,
  patch: Partial<Pick<Suite, 'name' | 'description' | 'tags' | 'isDefault'>>,
): Suite | undefined {
  const target = suites.find((s) => s.id === id)
  if (!target) return undefined
  const normalizedPatch: Partial<Pick<Suite, 'name' | 'description' | 'tags' | 'isDefault'>> = {
    ...patch,
    ...(patch.tags !== undefined ? { tags: validateTags(patch.tags) } : {}),
  }
  const ts = nowIso()
  // If switching default, unset the previous default in the same project.
  if (normalizedPatch.isDefault === true && !target.isDefault) {
    suites = suites.map((s) =>
      s.projectId === target.projectId && s.id !== id && s.isDefault
        ? { ...s, isDefault: false, updatedAt: ts }
        : s,
    )
  }
  suites = suites.map((s) => (s.id === id ? { ...s, ...normalizedPatch, updatedAt: ts } : s))
  notify()
  return suites.find((s) => s.id === id)
}

export function deleteSuite(id: string): boolean {
  const target = suites.find((s) => s.id === id)
  if (!target) return false
  suites = suites.filter((s) => s.id !== id)
  // If the deleted suite was the default, promote the next-most-recent in the same project.
  if (target.isDefault) {
    const remaining = suites
      .filter((s) => s.projectId === target.projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    if (remaining.length > 0) {
      const ts = nowIso()
      const promotedId = remaining[0].id
      suites = suites.map((s) =>
        s.id === promotedId ? { ...s, isDefault: true, updatedAt: ts } : s,
      )
    }
  }
  notify()
  return true
}

export function setDefaultSuite(suiteId: string): Suite | undefined {
  const target = suites.find((s) => s.id === suiteId)
  if (!target) return undefined
  const ts = nowIso()
  suites = suites.map((s) => {
    if (s.projectId !== target.projectId) return s
    const isNewDefault = s.id === suiteId
    if (s.isDefault === isNewDefault) return s
    return { ...s, isDefault: isNewDefault, updatedAt: ts }
  })
  notify()
  return suites.find((s) => s.id === suiteId)
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

function maskKey(apiKey: string): string {
  if (apiKey.length <= 10) return `${apiKey.slice(0, 2)}...${apiKey.slice(-2)}`
  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`
}

export function connectAiProvider(provider: AiProvider, apiKey: string): AiProviderConnection {
  aiProviders = aiProviders.map((p) =>
    p.provider === provider
      ? { ...p, connected: true, maskedKey: maskKey(apiKey), connectedAt: nowIso() }
      : p,
  )
  notify()
  return aiProviders.find((p) => p.provider === provider)!
}

export function disconnectAiProvider(provider: AiProvider): AiProviderConnection {
  aiProviders = aiProviders.map((p) =>
    p.provider === provider
      ? { ...p, connected: false, maskedKey: undefined, connectedAt: undefined }
      : p,
  )
  notify()
  return aiProviders.find((p) => p.provider === provider)!
}

export function sendChatMessage(
  projectId: string,
  content: string,
): { userMessage: ChatMessage; assistantMessage: ChatMessage } {
  const thread = getChatThread(projectId)
  const ts = nowIso()

  const userMessage: ChatMessage = {
    id: `msg-${chatMessages.length + 1}`,
    threadId: thread.id,
    role: 'user',
    content,
    createdAt: ts,
  }
  chatMessages = [...chatMessages, userMessage]

  let generatedCaseIds: string[] | undefined
  let generatedCaseName: string | undefined

  if (wantsCaseGeneration(content)) {
    const newCase: AiCase = {
      id: `ai-${aiCases.length + 1}`,
      name: `Case drafted from chat: ${content.slice(0, 60)}`,
      steps: ['Reproduce the scenario described in the chat request', 'Verify the expected behavior'],
      expectedResult: 'Behavior matches the scenario requested in chat',
      sourceFile: 'chat-generated',
      sourceSnippet: content,
      reviewStatus: 'pending',
      projectId,
      source: 'chat',
    }
    aiCases = [...aiCases, newCase]
    generatedCaseIds = [newCase.id]
    generatedCaseName = newCase.name
  }

  const projectCases = aiCases.filter((c) => c.projectId === projectId)
  const pendingCount = projectCases.filter((c) => c.reviewStatus === 'pending').length
  const replyText = buildAssistantReply({
    projectCaseCount: projectCases.length,
    pendingCount,
    requestText: content,
    generatedCaseName,
  })

  const assistantMessage: ChatMessage = {
    id: `msg-${chatMessages.length + 1}`,
    threadId: thread.id,
    role: 'assistant',
    content: replyText,
    createdAt: nowIso(),
    generatedCaseIds,
  }
  chatMessages = [...chatMessages, assistantMessage]
  chatThreads = chatThreads.map((t) => (t.id === thread.id ? { ...t, updatedAt: assistantMessage.createdAt } : t))

  notify()
  return { userMessage, assistantMessage }
}

export function confirmAllPending(projectId: string): void {
  aiCases = aiCases.map((c) =>
    c.projectId === projectId && c.reviewStatus === 'pending'
      ? { ...c, reviewStatus: 'confirmed' as const }
      : c,
  )
  notify()
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
  aiProviders = structuredClone(mockAiProviders)
  chatThreads = structuredClone(mockChatThreads)
  chatMessages = structuredClone(mockChatMessages)
  coverageGaps = structuredClone(mockCoverageGaps)
  notify()
}
