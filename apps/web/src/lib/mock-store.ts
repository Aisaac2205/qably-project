/**
 * In-memory pub-sub data store seeded from mock data.
 *
 * Phase 1 transitional layer. Replace with fetch-based calls in Phase 2.
 * React hooks use useSyncExternalStore — no Zustand needed in Phase 1.
 */
import {
  mockProjects,
  mockSuites,
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
  mockQualityRisks,
  mockIngestionBatches,
  mockIngestionEvidence,
  MOCK_NOW,
} from '@/lib/mock-data'
import { validateTags } from '@/lib/tag-validation'
import { wantsCaseGeneration, buildAssistantReply } from '@/features/projects/test-generation/lib/generate-mock-reply'
import type {
  ProjectSummary,
  AiCase,
  Organization,
  OrgMember,
  ApiKey,
  GithubIntegration,
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
  ExtractedProposal,
  ReviewDecision,
  OfficialTestCase,
  TestCaseVersion,
  TraceabilityLink,
  Evidence,
  QualityRisk,
  ReviewScenario,
  ProposalMutationResult,
} from '@qably/types'

// ── Types ─────────────────────────────────────────────────────────

type Listener = () => void

export interface StoreSnapshot {
  projects: ProjectSummary[]
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
  proposals: ExtractedProposal[]
  proposalIdByAiCaseId: Record<string, string>
  reviewDecisions: ReviewDecision[]
  officialTestCases: OfficialTestCase[]
  testCaseVersions: TestCaseVersion[]
  traceabilityLinks: TraceabilityLink[]
  evidence: Evidence[]
  qualityRisks: QualityRisk[]
}

// ── State ─────────────────────────────────────────────────────────

let projects: ProjectSummary[] = structuredClone(mockProjects)
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
let reviewDecisions: ReviewDecision[] = []
let qualityRisks: QualityRisk[] = structuredClone(mockQualityRisks)
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
    projects, aiCases, org, members, apiKeys, integration,
    aiProviders, chatThreads, chatMessages, coverageGaps, connections, notifications,
    ingestionBatches, proposals, proposalIdByAiCaseId, reviewDecisions, officialTestCases,
    testCaseVersions, traceabilityLinks, evidence, qualityRisks,
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

export function getProjects(): ProjectSummary[] {
  return projects
}

export function getProject(id: string): ProjectSummary | undefined {
  return projects.find((p) => p.id === id)
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

export function getChatThreads(projectId: string): ChatThread[] {
  return chatThreads
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getChatThread(id: string): ChatThread | undefined {
  return chatThreads.find((t) => t.id === id)
}

export function createChatThread(projectId: string): ChatThread {
  const ts = nowIso()
  const newThread: ChatThread = {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId,
    createdAt: ts,
    updatedAt: ts,
  }
  chatThreads = [newThread, ...chatThreads]
  notify()
  return newThread
}

export function deleteChatThread(threadId: string): boolean {
  const before = chatThreads.length
  chatThreads = chatThreads.filter((t) => t.id !== threadId)
  if (chatThreads.length === before) return false
  chatMessages = chatMessages.filter((m) => m.threadId !== threadId)
  notify()
  return true
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

export function getServerNotifications(): Notification[] {
  return FROZEN_SEEDED.notifications
}

export function markNotificationAsRead(id: string): void {
  const ts = nowIso()
  notifications = notifications.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? ts } : n))
  notify()
}

export function toggleNotificationRead(id: string): void {
  const ts = nowIso()
  notifications = notifications.map((n) => (n.id === id ? { ...n, readAt: n.readAt ? undefined : ts } : n))
  notify()
}

export function markAllNotificationsAsRead(projectId?: string): void {
  const ts = nowIso()
  notifications = notifications.map((n) => {
    if (projectId && n.projectId !== projectId) return n
    return { ...n, readAt: n.readAt ?? ts }
  })
  notify()
}

export function getIngestionBatches(projectId?: string): IngestionBatch[] {
  return projectId ? ingestionBatches.filter((batch) => batch.projectId === projectId) : ingestionBatches
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

export function getOfficialTestCases(suiteId?: string, projectId?: string): OfficialTestCase[] {
  let list = officialTestCases
  if (suiteId) {
    list = list.filter((tc) => tc.suiteId === suiteId)
  }
  if (projectId) {
    list = list.filter((tc) => tc.projectId === projectId)
  }
  return list
}

export function getTestCaseVersions(testCaseId?: string): TestCaseVersion[] {
  if (!testCaseId) return testCaseVersions
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
  const suiteId =
    existingCase?.suiteId ??
    mockSuites.find((suite) => suite.projectId === proposal.projectId)?.id
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



// ── Connection aggregate (Commit 2) ────────────────────────────────────────

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

export function createApiKey(name: string, projectId = 'proj-1'): ApiKey {
  const id = `key-${apiKeys.length + 1}`
  const lookupId = Math.random().toString(16).slice(2, 14)
  const lastFour = Math.random().toString(16).slice(2, 6)
  const newKey: ApiKey = {
    id,
    projectId,
    name,
    prefix: `qbly_${lookupId}`,
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
  threadId?: string,
): { userMessage: ChatMessage; assistantMessage: ChatMessage; thread: ChatThread } {
  let thread = threadId ? chatThreads.find((t) => t.id === threadId && t.projectId === projectId) : undefined
  if (!thread) {
    thread = createChatThread(projectId)
  }
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
  return { userMessage, assistantMessage, thread }
}

// ── Test-only reset ───────────────────────────────────────────────

export function __resetStore(): void {
  projects = structuredClone(mockProjects)
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
  reviewDecisions = []
  qualityRisks = structuredClone(mockQualityRisks)
  notify()
}
