// ─── Status types ────────────────────────────────────────────────────────────

export type CaseStatus = 'pass' | 'fail' | 'skip' | 'blocked' | 'running' | 'pending'
export type RunStatus = 'pass' | 'fail' | 'running' | 'pending'
export type ReviewStatus = 'pending' | 'confirmed' | 'rejected'
export type CasePriority = 'critical' | 'high' | 'medium' | 'low'
export type CaseState = 'active' | 'draft' | 'deprecated'
export type OrgRole = 'owner' | 'admin' | 'member'
export type Plan = 'free' | 'pro' | 'agency'
export type PipelineStatus = 'pass' | 'fail' | 'running' | 'pending' | 'cancelled'
export type RunSource = 'manual' | 'api' | 'github_actions'

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
}

// ─── Pipelines ────────────────────────────────────────────────────────────────

export interface PipelineRun {
  id: string
  projectId: string
  branch: string
  commitSha: string
  commitMessage: string
  status: PipelineStatus
  runId?: string
  triggeredAt: string
  finishedAt?: string
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export interface GithubIntegration {
  webhookUrl: string
  webhookSecret?: string
  connected: boolean
  repoUrl?: string
}
