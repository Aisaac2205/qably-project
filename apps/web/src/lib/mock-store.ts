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
  mockConnections,
  mockNotifications,
  mockIngestionBatches,
  mockCodeChanges,
  mockIngestionEvidence,
  MOCK_NOW,
} from '@/lib/mock-data'
import { validateTags } from '@/lib/tag-validation'
import { wantsCaseGeneration, buildAssistantReply } from '@/features/projects/test-generation/lib/generate-mock-reply'
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
  CasePriority,
  CaseState,
  TestCase,
  AiProvider,
  AiProviderConnection,
  ChatThread,
  ChatMessage,
  CoverageGap,
  Connection,
  ConnectionStatus,
  ConnectionType,
  Notification,
  IngestionBatch,
  CodeChange,
  ExtractedProposal,
  ReviewDecision,
  OfficialTestCase,
  TestCaseVersion,
  TraceabilityLink,
  Execution,
  ExecutionResult,
  Evidence,
  QualityRisk,
  ReviewScenario,
  ProposalMutationResult,
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
  connections: Connection[]
  notifications: Notification[]
  ingestionBatches: IngestionBatch[]
  codeChanges: CodeChange[]
  proposals: ExtractedProposal[]
  proposalIdByAiCaseId: Record<string, string>
  reviewDecisions: ReviewDecision[]
  officialTestCases: OfficialTestCase[]
  testCaseVersions: TestCaseVersion[]
  traceabilityLinks: TraceabilityLink[]
  executions: Execution[]
  executionResults: ExecutionResult[]
  evidence: Evidence[]
  qualityRisks: QualityRisk[]
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
let connections: Connection[] = structuredClone(mockConnections)
let notifications: Notification[] = structuredClone(mockNotifications)

function createReviewDomain() {
  const evidence = [...mockAiCases.map<Evidence>((aiCase) => ({
    id: `evidence-${aiCase.id}`,
    projectId: aiCase.projectId,
    kind: aiCase.source === 'chat' ? 'artifact' : 'source_excerpt',
    title: aiCase.sourceFile,
    uri: `mock://${aiCase.sourceFile}`,
    excerpt: aiCase.sourceSnippet,
    createdAt: MOCK_NOW,
  })), ...structuredClone(mockIngestionEvidence)]
  const proposalIdByAiCaseId = Object.fromEntries(mockAiCases.map((aiCase) => [
    aiCase.id,
    aiCase.id === 'ai-2' ? 'review-proposal-checkout' : `proposal-${aiCase.id}`,
  ]))
  const proposals = mockAiCases.map<ExtractedProposal>((aiCase) => ({
    id: proposalIdByAiCaseId[aiCase.id],
    projectId: aiCase.projectId,
    status: aiCase.reviewStatus === 'rejected' ? 'rejected' : aiCase.reviewStatus === 'confirmed' ? 'approved' : 'in_review',
    title: aiCase.name,
    objective: aiCase.name,
    preconditions: [],
    steps: aiCase.steps,
    expectedResult: aiCase.expectedResult,
    priority: 'medium',
    evidenceId: `evidence-${aiCase.id}`,
    targetOfficialTestCaseId: aiCase.possibleDuplicateOf ? `case-${aiCase.possibleDuplicateOf}` : undefined,
  }))
  const existingCases = mockSuites.flatMap((suite) => suite.cases.map<OfficialTestCase>((testCase) => ({
    id: `case-${testCase.id}`,
    projectId: suite.projectId,
    suiteId: suite.id,
    lifecycle: testCase.state === 'deprecated' ? 'deprecated' : 'active',
    currentVersionId: `version-${testCase.id}-1`,
    createdAt: suite.createdAt,
  })))
  const versions = mockSuites.flatMap((suite) => suite.cases.map<TestCaseVersion>((testCase) => ({
    id: `version-${testCase.id}-1`,
    testCaseId: `case-${testCase.id}`,
    version: 1,
    title: testCase.name,
    objective: testCase.name,
    preconditions: [],
    steps: testCase.steps,
    expectedResult: testCase.expectedResult,
    priority: testCase.priority,
    publishedAt: suite.updatedAt,
  })))
  return {
    evidence,
    proposals,
    proposalIdByAiCaseId,
    officialTestCases: existingCases,
    testCaseVersions: versions,
    traceabilityLinks: [
      ...proposals.map<TraceabilityLink>((proposal) => ({
        id: `link-${proposal.id}-evidence`,
        from: { type: 'proposal', id: proposal.id },
        to: { type: 'evidence', id: proposal.evidenceId },
        relation: 'evidence_for',
      })),
      // Repository detection (Phase 2) and AI Review extraction (Phase 3
      // proposals) are still separate mock domains. This is the one curated
      // bridge showing a code change that already led to an extraction
      // proposal, without simulating a publication that hasn't happened.
      {
        id: 'link-change-empty-cart-1-produced-review-proposal-checkout',
        from: { type: 'code_change', id: 'change-empty-cart-1' },
        to: { type: 'proposal', id: 'review-proposal-checkout' },
        relation: 'produced',
      } satisfies TraceabilityLink,
    ],
  }
}

let reviewDomain = createReviewDomain()
let { evidence, proposals, proposalIdByAiCaseId, officialTestCases, testCaseVersions, traceabilityLinks } = reviewDomain
let ingestionBatches: IngestionBatch[] = structuredClone(mockIngestionBatches)
let codeChanges: CodeChange[] = structuredClone(mockCodeChanges)
let reviewDecisions: ReviewDecision[] = []
let executions: Execution[] = []
let executionResults: ExecutionResult[] = []
let qualityRisks: QualityRisk[] = []
const reviewScenarios: ReviewScenario[] = [
  { id: 'approval-new', proposalId: 'proposal-ai-4' },
  { id: 'approval-version', proposalId: 'review-proposal-checkout' },
  { id: 'rejection-evidence', proposalId: 'proposal-ai-3' },
]

// ── Pub-sub ───────────────────────────────────────────────────────

const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((l) => l())
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  listener()
  return () => { listeners.delete(listener) }
}

function currentSnapshot(): StoreSnapshot {
  return {
    projects, suites, runs, aiCases, org, members, apiKeys, integration,
    aiProviders, chatThreads, chatMessages, coverageGaps, connections, notifications,
    ingestionBatches, codeChanges, proposals, proposalIdByAiCaseId, reviewDecisions, officialTestCases,
    testCaseVersions, traceabilityLinks, executions, executionResults, evidence, qualityRisks,
  }
}

// The client bundle starts from the same deterministic mock seed. Returning
// this stable snapshot lets server HTML hydrate without replacing seeded UI.
const FROZEN_SEEDED: StoreSnapshot = Object.freeze(currentSnapshot())

export function getSnapshot(): StoreSnapshot {
  return currentSnapshot()
}

export function getServerSnapshot(): StoreSnapshot {
  return FROZEN_SEEDED
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

export function getAiCase(id: string): AiCase | undefined {
  return aiCases.find((c) => c.id === id)
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

export function getChatThread(projectId: string): ChatThread | undefined {
  return chatThreads.find((t) => t.projectId === projectId)
}

function createChatThread(projectId: string): ChatThread {
  const ts = nowIso()
  const newThread: ChatThread = { id: `thread-${projectId}`, projectId, createdAt: ts, updatedAt: ts }
  chatThreads = [...chatThreads, newThread]
  return newThread
}

export function getChatMessages(threadId: string): ChatMessage[] {
  return chatMessages.filter((m) => m.threadId === threadId)
}

export function getCoverageGaps(projectId?: string): CoverageGap[] {
  if (!projectId) return coverageGaps
  return coverageGaps.filter((g) => g.projectId === projectId)
}

export function getQualityRisks(projectId?: string): QualityRisk[] {
  if (!projectId) return qualityRisks
  return qualityRisks.filter((r) => r.projectId === projectId)
}

export function getNotifications(): Notification[] {
  return notifications
}

export function getIngestionBatches(projectId?: string): IngestionBatch[] {
  return projectId ? ingestionBatches.filter((batch) => batch.projectId === projectId) : ingestionBatches
}

export function getCodeChanges(projectId?: string): CodeChange[] {
  return projectId ? codeChanges.filter((change) => change.projectId === projectId) : codeChanges
}

export function getProposal(id: string): ExtractedProposal | undefined {
  return proposals.find((proposal) => proposal.id === id)
}

export function getProposalForAiReviewCase(caseId: string): ExtractedProposal | undefined {
  const proposalId = proposalIdByAiCaseId[caseId]
  return proposalId ? getProposal(proposalId) : undefined
}

export function getOfficialTestCase(id: string): OfficialTestCase | undefined {
  return officialTestCases.find((testCase) => testCase.id === id)
}

export function getTestCaseVersions(testCaseId: string): TestCaseVersion[] {
  return testCaseVersions.filter((version) => version.testCaseId === testCaseId)
}

export function getTestCaseVersion(id: string): TestCaseVersion | undefined {
  return testCaseVersions.find((version) => version.id === id)
}

export function getTraceabilityLinks({ entityId }: { entityId: string }): TraceabilityLink[] {
  return traceabilityLinks.filter((link) => link.from.id === entityId || link.to.id === entityId)
}

export function getReviewScenario(id: ReviewScenario['id']): ReviewScenario {
  return reviewScenarios.find((scenario) => scenario.id === id)!
}

type ApprovalResult =
  | ({ ok: true; createdNewCase: boolean; officialTestCase: OfficialTestCase; version: TestCaseVersion; decision: ReviewDecision })
  | Extract<ProposalMutationResult, { ok: false }>

export function approveProposal(
  proposalId: string,
  input: { actorId: string; comment?: string },
): ApprovalResult {
  const proposal = getProposal(proposalId)
  if (!proposal) return { ok: false, reason: 'not_found' }
  if (proposal.status !== 'in_review') return { ok: false, reason: 'invalid_transition' }
  if (!evidence.some((item) => item.id === proposal.evidenceId)) return { ok: false, reason: 'missing_evidence' }

  const timestamp = nowIso()
  const existingCase = proposal.targetOfficialTestCaseId
    ? getOfficialTestCase(proposal.targetOfficialTestCaseId)
    : undefined
  const suiteId = existingCase?.suiteId ?? getSuites(proposal.projectId)[0]?.id
  if (!suiteId) return { ok: false, reason: 'missing_evidence' }

  const createdNewCase = !existingCase
  const testCase: OfficialTestCase = existingCase ?? {
    id: `case-${officialTestCases.length + 1}`,
    projectId: proposal.projectId,
    suiteId,
    lifecycle: 'active',
    currentVersionId: '',
    createdAt: timestamp,
  }
  const nextVersion: TestCaseVersion = {
    id: `version-${testCase.id}-${getTestCaseVersions(testCase.id).length + 1}`,
    testCaseId: testCase.id,
    version: getTestCaseVersions(testCase.id).length + 1,
    title: proposal.title,
    objective: proposal.objective,
    preconditions: proposal.preconditions,
    steps: proposal.steps,
    expectedResult: proposal.expectedResult,
    priority: proposal.priority,
    publishedAt: timestamp,
  }
  const decision: ReviewDecision = {
    id: `decision-${reviewDecisions.length + 1}`,
    proposalId,
    actorId: input.actorId,
    action: 'approved',
    comment: input.comment,
    decidedAt: timestamp,
  }

  // Build every affected collection first; only then expose the approved graph.
  const nextProposal = { ...proposal, status: 'approved' as const }
  const nextCases = createdNewCase
    ? [...officialTestCases, { ...testCase, currentVersionId: nextVersion.id }]
    : officialTestCases.map((item) => item.id === testCase.id ? { ...item, currentVersionId: nextVersion.id } : item)
  const nextLinks = [
    ...traceabilityLinks,
    { id: `link-${proposalId}-${testCase.id}`, from: { type: 'proposal' as const, id: proposalId }, to: { type: 'test_case' as const, id: testCase.id }, relation: 'produced' as const },
    { id: `link-${nextVersion.id}-${testCase.id}`, from: { type: 'test_case_version' as const, id: nextVersion.id }, to: { type: 'test_case' as const, id: testCase.id }, relation: 'version_of' as const },
  ]
  const aiCaseId = Object.keys(proposalIdByAiCaseId).find((caseId) => proposalIdByAiCaseId[caseId] === proposalId)
  const nextAiCases = aiCases.map((item) => item.id === aiCaseId
    ? { ...item, reviewStatus: 'confirmed' as const }
    : item)

  proposals = proposals.map((item) => item.id === proposalId ? nextProposal : item)
  aiCases = nextAiCases
  officialTestCases = nextCases
  testCaseVersions = [...testCaseVersions, nextVersion]
  traceabilityLinks = nextLinks
  reviewDecisions = [...reviewDecisions, decision]
  notify()
  return { ok: true, createdNewCase, officialTestCase: nextCases.find((item) => item.id === testCase.id)!, version: nextVersion, decision }
}

export function rejectProposal(
  proposalId: string,
  input: { actorId: string; comment?: string },
): ProposalMutationResult {
  const proposal = getProposal(proposalId)
  if (!proposal) return { ok: false, reason: 'not_found' }
  if (proposal.status !== 'in_review') return { ok: false, reason: 'invalid_transition' }
  const decision: ReviewDecision = {
    id: `decision-${reviewDecisions.length + 1}`,
    proposalId,
    actorId: input.actorId,
    action: 'rejected',
    comment: input.comment,
    decidedAt: nowIso(),
  }
  const aiCaseId = Object.keys(proposalIdByAiCaseId).find((caseId) => proposalIdByAiCaseId[caseId] === proposalId)
  proposals = proposals.map((item) => item.id === proposalId ? { ...item, status: 'rejected' } : item)
  aiCases = aiCases.map((item) => item.id === aiCaseId ? { ...item, reviewStatus: 'rejected' as const } : item)
  reviewDecisions = [...reviewDecisions, decision]
  notify()
  return { ok: true, decision }
}

export function getServerNotifications(): Notification[] {
  return FROZEN_SEEDED.notifications
}

// ── Connection aggregate (Commit 2) ────────────────────────────────────────

// In-memory log of CI webhook events received. The runs/ module (Commit 3)
// subscribes to this via the bus; for now we just keep a ring buffer so
// the integrations UI can show "last received event" per connection.
const ciEventLog: import('@/features/integrations/ci-providers/types').NormalizedCIEvent[] = []
const CI_LOG_MAX = 50

export function recordCiEvent(event: import('@/features/integrations/ci-providers/types').NormalizedCIEvent): void {
  ciEventLog.push(event)
  if (ciEventLog.length > CI_LOG_MAX) ciEventLog.shift()
  notify()
}

export function getCiEventLog(): import('@/features/integrations/ci-providers/types').NormalizedCIEvent[] {
  return ciEventLog
}

export function getConnections(): Connection[] {
  return connections
}

export function getConnection(id: string): Connection | undefined {
  return connections.find((c) => c.id === id)
}

export function createConnection(input: {
  type: ConnectionType
  name: string
  config?: Record<string, string>
}): Connection {
  const id = `conn-${connections.length + 1}`
  const newConnection: Connection = {
    id,
    type: input.type,
    name: input.name,
    status: 'pending',
    config: input.config,
    createdAt: nowIso(),
  }
  connections = [...connections, newConnection]
  notify()
  return newConnection
}

export function updateConnection(
  id: string,
  patch: Partial<Pick<Connection, 'name' | 'config' | 'lastSyncAt'>>,
): Connection | undefined {
  const target = connections.find((c) => c.id === id)
  if (!target) return undefined
  connections = connections.map((c) => (c.id === id ? { ...c, ...patch } : c))
  notify()
  return connections.find((c) => c.id === id)
}

export function deleteConnection(id: string): boolean {
  const before = connections.length
  connections = connections.filter((c) => c.id !== id)
  if (connections.length === before) return false
  notify()
  return true
}

/**
 * Connection state machine. Returns the updated connection or undefined if
 * the id is missing or the transition is invalid from the current status.
 *   pending      → connect → connected
 *   disconnected → connect → connected
 *   connected    → disconnect → disconnected
 *   pending      → disconnect → disconnected
 * Anything else is a no-op (returns undefined; no event emitted).
 */
export function transitionConnection(
  id: string,
  action: 'connect' | 'disconnect',
): Connection | undefined {
  const target = connections.find((c) => c.id === id)
  if (!target) return undefined
  const next: ConnectionStatus | null = (() => {
    if (action === 'connect') {
      if (target.status === 'pending' || target.status === 'disconnected') return 'connected'
      return null
    }
    if (action === 'disconnect') {
      if (target.status === 'connected' || target.status === 'pending') return 'disconnected'
      return null
    }
    return null
  })()
  if (next === null) return undefined
  connections = connections.map((c) => (c.id === id ? { ...c, status: next } : c))
  notify()
  return connections.find((c) => c.id === id)
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

// ── Case mutators (cases live embedded in Suite.cases) ────────────

function nextCaseId(): string {
  let max = 0
  for (const s of suites) {
    for (const c of s.cases) {
      const match = /^tc-(\d+)$/.exec(c.id)
      if (match) max = Math.max(max, Number(match[1]))
    }
  }
  return `tc-${max + 1}`
}

export function createCase(
  suiteId: string,
  input: {
    name: string
    steps?: string[]
    expectedResult?: string
    priority?: CasePriority
    state?: CaseState
  },
): TestCase | undefined {
  const target = suites.find((s) => s.id === suiteId)
  if (!target) return undefined
  const newCase: TestCase = {
    id: nextCaseId(),
    suiteId,
    name: input.name,
    steps: input.steps ?? [],
    expectedResult: input.expectedResult ?? '',
    priority: input.priority ?? 'medium',
    state: input.state ?? 'active',
  }
  const ts = nowIso()
  suites = suites.map((s) =>
    s.id === suiteId ? { ...s, cases: [...s.cases, newCase], updatedAt: ts } : s,
  )
  notify()
  return newCase
}

export function updateCase(
  suiteId: string,
  caseId: string,
  patch: Partial<Pick<TestCase, 'name' | 'steps' | 'expectedResult' | 'priority' | 'state'>>,
): TestCase | undefined {
  const target = suites.find((s) => s.id === suiteId)
  if (!target) return undefined
  if (!target.cases.some((c) => c.id === caseId)) return undefined
  const ts = nowIso()
  suites = suites.map((s) =>
    s.id === suiteId
      ? {
          ...s,
          cases: s.cases.map((c) => (c.id === caseId ? { ...c, ...patch } : c)),
          updatedAt: ts,
        }
      : s,
  )
  notify()
  return suites.find((s) => s.id === suiteId)?.cases.find((c) => c.id === caseId)
}

export function deleteCase(suiteId: string, caseId: string): boolean {
  const target = suites.find((s) => s.id === suiteId)
  if (!target) return false
  if (!target.cases.some((c) => c.id === caseId)) return false
  const ts = nowIso()
  suites = suites.map((s) =>
    s.id === suiteId
      ? { ...s, cases: s.cases.filter((c) => c.id !== caseId), updatedAt: ts }
      : s,
  )
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

export function updateRun(
  id: string,
  patch: Partial<Pick<Run, 'name' | 'status' | 'passRate' | 'finishedAt'>>,
): Run | undefined {
  const target = runs.find((r) => r.id === id)
  if (!target) return undefined
  runs = runs.map((r) => (r.id === id ? { ...r, ...patch } : r))
  notify()
  return runs.find((r) => r.id === id)
}

export function deleteRun(id: string): boolean {
  const before = runs.length
  runs = runs.filter((r) => r.id !== id)
  if (runs.length === before) return false
  notify()
  return true
}

/**
 * Run state machine. Returns the updated run or undefined if the id is
 * missing or the transition is invalid from the current status.
 *   running    → 'complete' → 'pass'
 *   running    → 'fail'     → 'fail'
 *   pending    → 'start'    → 'running'
 * Anything else is a no-op (returns undefined).
 */
export function transitionRun(
  id: string,
  action: 'start' | 'complete' | 'fail',
): Run | undefined {
  const target = runs.find((r) => r.id === id)
  if (!target) return undefined
  const next: Run['status'] | null = (() => {
    if (action === 'start' && target.status === 'pending') return 'running'
    if (action === 'complete' && target.status === 'running') return 'pass'
    if (action === 'fail' && target.status === 'running') return 'fail'
    return null
  })()
  if (next === null) return undefined
  const finishedAt = next === 'pass' || next === 'fail' ? nowIso() : target.finishedAt
  runs = runs.map((r) => (r.id === id ? { ...r, status: next, finishedAt } : r))
  notify()
  return runs.find((r) => r.id === id)
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

export function markNotificationAsRead(id: string): Notification | undefined {
  const notification = notifications.find((item) => item.id === id)
  if (!notification || notification.readAt) return notification
  const readAt = nowIso()
  notifications = notifications.map((item) => (item.id === id ? { ...item, readAt } : item))
  notify()
  return notifications.find((item) => item.id === id)
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

export function deleteProject(id: string): boolean {
  const before = projects.length
  projects = projects.filter((p) => p.id !== id)
  if (projects.length === before) return false
  notify()
  return true
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
  const thread = getChatThread(projectId) ?? createChatThread(projectId)
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

    // Chat-drafted cases must be governed by the same ExtractedProposal
    // contract as repository-detected ones so the AI Review queue (which
    // reads proposals, not AiCase) can surface them.
    const newEvidence: Evidence = {
      id: `evidence-${newCase.id}`,
      projectId,
      kind: 'artifact',
      title: newCase.sourceFile,
      uri: `mock://chat/${newCase.id}`,
      excerpt: newCase.sourceSnippet,
      createdAt: ts,
    }
    const newProposal: ExtractedProposal = {
      id: `proposal-${newCase.id}`,
      projectId,
      status: 'in_review',
      title: newCase.name,
      objective: newCase.name,
      preconditions: [],
      steps: newCase.steps,
      expectedResult: newCase.expectedResult,
      priority: 'medium',
      evidenceId: newEvidence.id,
    }
    evidence = [...evidence, newEvidence]
    proposals = [...proposals, newProposal]
    proposalIdByAiCaseId = { ...proposalIdByAiCaseId, [newCase.id]: newProposal.id }
    traceabilityLinks = [...traceabilityLinks, {
      id: `link-${newProposal.id}-evidence`,
      from: { type: 'proposal', id: newProposal.id },
      to: { type: 'evidence', id: newEvidence.id },
      relation: 'evidence_for',
    }]
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
  connections = structuredClone(mockConnections)
  notifications = structuredClone(mockNotifications)
  reviewDomain = createReviewDomain()
  evidence = reviewDomain.evidence
  proposals = reviewDomain.proposals
  proposalIdByAiCaseId = reviewDomain.proposalIdByAiCaseId
  officialTestCases = reviewDomain.officialTestCases
  testCaseVersions = reviewDomain.testCaseVersions
  traceabilityLinks = reviewDomain.traceabilityLinks
  ingestionBatches = structuredClone(mockIngestionBatches)
  codeChanges = structuredClone(mockCodeChanges)
  reviewDecisions = []
  executions = []
  executionResults = []
  qualityRisks = []
  ciEventLog.length = 0
  notify()
}
