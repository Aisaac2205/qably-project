// ─── Status types ────────────────────────────────────────────────────────────

export type CaseStatus = 'pass' | 'fail' | 'skip' | 'blocked' | 'running' | 'pending'
export type RunStatus = 'pass' | 'fail' | 'running' | 'pending'
export type ReviewStatus = 'pending' | 'confirmed' | 'rejected'
export type CasePriority = 'critical' | 'high' | 'medium' | 'low'
export type CaseState = 'active' | 'draft' | 'deprecated'
export type OrgRole = 'owner' | 'admin' | 'member'
export type Plan = 'gratuito' | 'equipo' | 'empresa'
export type RunSource = 'manual' | 'api' | 'github_actions'
export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low'
export type NotificationChannel = 'in_app' | 'slack' | 'email'

/** Suite-level execution status, derived from run history (not stored on Suite). */
export type SuiteRunStatus = 'running' | 'pass' | 'fail' | 'needs-attention' | 'never-run'

// ─── Organization ─────────────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string
  plan: Plan
  planLimits: {
    maxProjects: number
    maxUsers: number
    maxCases: number
  }
}

export interface OrgMember {
  id: string
  userId: string
  name: string
  email: string
  role: OrgRole
  joinedAt: string
  avatarUrl?: string
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  lastFour: string
  createdAt: string
  lastUsedAt?: string
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  description?: string
  githubRepo?: string
  organizationId: string
  healthScore: number
  lastRunStatus: RunStatus
  lastRunAt: string
  suiteCount: number
  activeRunCount: number
  aiPendingCount: number
  createdAt: string
  technologies?: string[]
}

// ─── Suites & Cases ───────────────────────────────────────────────────────────

export interface TestCase {
  id: string
  suiteId: string
  name: string
  steps: string[]
  expectedResult: string
  priority: CasePriority
  state: CaseState
}

export interface Suite {
  id: string
  projectId: string
  organizationId: string
  name: string
  cases: TestCase[]
  createdAt: string
  /** Human-readable description of the suite's scope. Required; may be empty string. */
  description: string
  /** Lowercase short tags for filtering/labeling. Max 8 entries, 32 chars each, hyphens allowed, no spaces. */
  tags: string[]
  /** Whether this suite is the project's default (exactly one per project at most). */
  isDefault: boolean
  /** ISO timestamp of the last mutation to this suite. */
  updatedAt: string
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export interface RunCase {
  id: string
  name: string
  suite: string
  steps: string[]
  expectedResult: string
  status: CaseStatus
}

export interface Run {
  id: string
  projectId: string
  name: string
  suiteId: string
  suiteName: string
  cases: RunCase[]
  status: RunStatus
  passRate: number
  source: RunSource
  startedAt: string
  finishedAt?: string
  /** Who executed this run (manual/API). Typically undefined for CI runs. */
  executedBy?: { id: string; name: string }
  /** CI metadata — only populated when source === 'github_actions'. */
  commitSha?: string
  commitMessage?: string
  commitAuthor?: { name: string; email: string }
  branch?: string
  workflowName?: string
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  projectId: string
  runId: string
  testCaseId: string
  severity: NotificationSeverity
  message: string
  channel: NotificationChannel
  createdAt: string
  readAt?: string
}

// ─── Thesis-aligned QA flow ───────────────────────────────────────────────────

export type ProposalStatus = 'in_review' | 'approved' | 'rejected' | 'changes_requested'
export type ReviewDecisionAction = 'approved' | 'rejected' | 'changes_requested'
export type TraceabilityEntityType = 'code_change' | 'evidence' | 'proposal' | 'test_case' | 'test_case_version' | 'execution' | 'execution_result' | 'quality_risk'

export interface Evidence {
  id: string
  projectId: string
  kind: 'source_excerpt' | 'artifact' | 'url'
  title: string
  uri: string
  excerpt?: string
  createdAt: string
}
export interface CodeChange {
  id: string
  projectId: string
  pullRequestNumber?: number
  commitSha: string
  filePath: string
  diff: string
  detectedPattern?: string
  evidenceId: string
}
export interface IngestionBatch {
  id: string
  projectId: string
  source: 'repository' | 'webhook'
  status: 'pending' | 'completed' | 'failed'
  codeChangeIds: string[]
  createdAt: string
}
export interface ExtractedProposal {
  id: string
  projectId: string
  status: ProposalStatus
  title: string
  objective: string
  preconditions: string[]
  steps: string[]
  expectedResult: string
  priority: CasePriority
  evidenceId: string
  targetOfficialTestCaseId?: string
}
export interface ReviewDecision {
  id: string
  proposalId: string
  actorId: string
  action: ReviewDecisionAction
  comment?: string
  decidedAt: string
}
export interface OfficialTestCase {
  id: string
  projectId: string
  suiteId: string
  lifecycle: 'active' | 'deprecated'
  currentVersionId: string
  createdAt: string
}
export interface TestCaseVersion {
  id: string
  testCaseId: string
  version: number
  title: string
  objective: string
  preconditions: string[]
  steps: string[]
  expectedResult: string
  priority: CasePriority
  publishedAt: string
}
export interface TraceabilityLink {
  id: string
  from: { type: TraceabilityEntityType; id: string }
  to: { type: TraceabilityEntityType; id: string }
  relation: 'evidence_for' | 'produced' | 'version_of' | 'executed_as' | 'signals'
}
export interface Execution {
  id: string
  projectId: string
  environment: string
  testCaseVersionIds: string[]
  status: 'pending' | 'running' | 'completed'
}
export interface ExecutionResult {
  id: string
  executionId: string
  testCaseVersionId: string
  verdict: CaseStatus
  evidenceIds: string[]
}
export interface QualityRisk {
  id: string
  projectId: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  criteria: string[]
  evidenceIds: string[]
}
export interface ReviewScenario {
  id: 'approval-new' | 'approval-version' | 'rejection-evidence'
  proposalId: string
}
export type ProposalMutationResult =
  | { ok: true; decision: ReviewDecision }
  | { ok: false; reason: 'not_found' | 'invalid_transition' | 'missing_evidence' }

// ─── AI Cases ─────────────────────────────────────────────────────────────────

export interface AiCase {
  id: string
  name: string
  steps: string[]
  expectedResult: string
  sourceFile: string
  sourceSnippet: string
  reviewStatus: ReviewStatus
  projectId: string
  /** Where this case originated. Defaults to 'webhook' for pre-existing mock data. */
  source: 'webhook' | 'chat'
  /** Reference to an existing TestCase when the AI detects a possible duplicate. */
  possibleDuplicateOf?: string
  /** @deprecated Use possibleDuplicateOf. Retained for existing consumers. */
  duplicateOfCaseId?: string
  /** 0-1 similarity score, only present when a duplicate reference is set. */
  similarityScore?: number
  /** Coverage gap that prompted this suggestion, when applicable. */
  coverageGapId?: string
}

// ─── AI Providers ─────────────────────────────────────────────────────────────

export type AiProvider = 'claude' | 'gemini'

export interface AiProviderConnection {
  provider: AiProvider
  label: string
  connected: boolean
  maskedKey?: string
  model: string
  connectedAt?: string
}

// ─── Project Chat ─────────────────────────────────────────────────────────────

export interface ChatThread {
  id: string
  projectId: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  threadId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  generatedCaseIds?: string[]
}

// ─── Coverage Gaps ─────────────────────────────────────────────────────────────

export interface CoverageGap {
  id: string
  projectId: string
  area: string
  description: string
  severity: 'high' | 'medium' | 'low'
  suggestedCaseCount: number
  suggestedCaseId: string
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export interface GithubIntegration {
  webhookUrl: string
  webhookSecret?: string
  connected: boolean
  repoUrl?: string
}

// Connection aggregate root — one row per third-party integration
// (CI provider, notification channel). The state machine is:
//   pending → connected → disconnected
// and is driven by `useConnections().transition()`.
export type ConnectionType =
  | 'github'
  | 'bitbucket'
  | 'gitlab'
  | 'slack'
  | 'discord'
  | 'email'

export type ConnectionStatus = 'pending' | 'connected' | 'disconnected' | 'error'

export interface Connection {
  id: string
  type: ConnectionType
  name: string
  status: ConnectionStatus
  /** Provider-specific configuration (repo URL, channel ID, email, etc.). */
  config?: Record<string, string>
  createdAt: string
  lastSyncAt?: string
}
