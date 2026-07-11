// ─── Status types ────────────────────────────────────────────────────────────

export type CaseStatus = 'pass' | 'fail' | 'skip' | 'blocked' | 'running' | 'pending'
export type RunStatus = 'pass' | 'fail' | 'running' | 'pending'
export type ReviewStatus = 'pending' | 'confirmed' | 'rejected'
export type CasePriority = 'critical' | 'high' | 'medium' | 'low'
export type CaseState = 'active' | 'draft' | 'deprecated'
export type OrgRole = 'owner' | 'admin' | 'member'
export type Plan = 'free' | 'pro' | 'agency'
export type RunSource = 'manual' | 'api' | 'github_actions'

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
  /** Set when the AI detects this case is similar to an existing TestCase. */
  duplicateOfCaseId?: string
  /** 0-1 similarity score, only present when duplicateOfCaseId is set. */
  similarityScore?: number
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
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export interface GithubIntegration {
  webhookUrl: string
  webhookSecret?: string
  connected: boolean
  repoUrl?: string
}
