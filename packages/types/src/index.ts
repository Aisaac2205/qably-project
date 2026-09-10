// ─── Status types ────────────────────────────────────────────────────────────

export type CaseStatus = 'pass' | 'fail' | 'skip' | 'blocked' | 'running' | 'pending'
export type RunStatus = 'pass' | 'fail' | 'running' | 'pending'
export type ReviewStatus = 'pending' | 'confirmed' | 'rejected'
export type CasePriority = 'critical' | 'high' | 'medium' | 'low'
export type CaseState = 'active' | 'draft' | 'deprecated'
export type ExecutionMode = 'manual' | 'automated'
export type OrgRole = 'owner' | 'admin' | 'member'
export type Plan = 'gratuito' | 'equipo' | 'empresa'
export type RunSource = 'manual' | 'api' | 'github_actions'
export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low'
export type NotificationChannel = 'in_app' | 'email' | 'slack' | 'discord'
export type NotificationEventType =
  | 'run_failed'
  | 'run_completed'
  | 'case_regressed'
  | 'ingestion_failed'
  | 'connection_security'
export type NotificationWebhookType = 'slack' | 'discord'

export type SuiteRunStatus = 'running' | 'pass' | 'fail' | 'needs-attention' | 'never-run'


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
  projectId: string
  name: string
  prefix: string
  lastFour: string
  createdAt: string
  lastUsedAt?: string
  revokedAt?: string
}

export interface ApiKeyWithSecret extends ApiKey {
  token: string
}

export const TECH_KEYS = [
  'react',
  'typescript',
  'javascript',
  'angular',
  'nestjs',
  'express',
  'java',
  'php',
  'vite',
  'flutter',
  'laravel',
  'springboot',
  'postgresql',
  'cloudflare',
  'nextjs',
  'vue',
  'mysql',
  'mongodb',
  'redis',
  'docker',
  'python',
  'django',
  'go',
  'fastapi',
  'playwright',
  'jest',
  'astro',
] as const

export type TechKey = (typeof TECH_KEYS)[number]

export interface DetectedStack {
  technologies: TechKey[]
}

export interface Project {
  id: string
  name: string
  description?: string
  connectionId?: string
  githubRepo?: string
  organizationId: string
  technologies: string[]
  createdAt: string
  updatedAt: string
  hasManualCases?: boolean
}

export interface ProjectSummary extends Project {
  healthScore: number
  lastRunStatus: RunStatus
  lastRunAt: string
  suiteCount: number
  activeRunCount: number
  aiPendingCount: number
}

/**
 * Metrics that only exist once the Runs module lands. `null` on a project
 * means "not measured yet", never "zero" — the UI must not invent numbers.
 *
 * `healthScore` follows the same rule at the field level: a project can have
 * run before (so `activity` itself is non-null) while still having no run
 * inside the trailing metrics window. `null` there means "not measured in
 * this window", distinct from a real `0`, which means every case in the
 * window failed. The UI must render these two states differently.
 *
 * `aiPendingCount` belongs to the Review/AI domain, which has no API module
 * yet. It stays optional here and is omitted by the API until that domain
 * is real; the UI must treat a missing value the same way it treats a
 * missing `activity` object, never as zero.
 */
export interface ProjectActivity {
  healthScore: number | null
  lastRunStatus: RunStatus
  lastRunAt: string
  activeRunCount: number
  aiPendingCount?: number
}

export interface ProjectListItem extends Project {
  suiteCount: number
  activity: ProjectActivity | null
}

export interface OrganizationSummary {
  id: string
  name: string
  slug: string
  plan: Plan
  role: OrgRole
}

export interface OrganizationContext {
  organizationId: string
  slug: string
  role: OrgRole
}


export interface CaseLastResult {
  status: CaseStatus
  runId: string
  commitSha?: string
  recordedAt: string
}

export type CaseHealthSignal =
  | 'no-steps'
  | 'raw-name'
  | 'never-run'
  | 'flaky'
  | 'duplicate-key'
  | 'near-duplicate-title'

export type CaseHealthSummary = Partial<Record<CaseHealthSignal, number>>

export interface TestCase {
  id: string
  suiteId: string
  version: number | null
  name: string
  steps: string[]
  expectedResult: string
  priority: CasePriority
  state: CaseState
  executionMode: ExecutionMode
  automationKey?: string
  automationClassName?: string
  automationFilePath?: string
  lastResult?: CaseLastResult | null
  pendingProposalId?: string | null
  healthSignals?: CaseHealthSignal[]
  documentedLocale?: string | null
}

export interface Suite {
  id: string
  projectId: string
  organizationId: string
  name: string
  cases: TestCase[]
  manualCases: number
  automatedCases: number
  createdAt: string
  description: string
  tags: string[]
  isDefault: boolean
  updatedAt: string
  healthSummary?: CaseHealthSummary
}

export interface RunCaseOfficialCase {
  id: string
  suiteId: string
  version: number | null
  steps: string[]
  expectedResult: string
}

export interface RunCaseRecord {
  id: string
  testCaseId: string | null
  officialCase: RunCaseOfficialCase | null
  name: string
  suiteName: string
  steps: string[]
  expectedResult: string
  status: CaseStatus
  position: number
  recordedAt?: string
  className?: string
  filePath?: string
  durationMs?: number
  failureType?: string
  failureMessage?: string
  failureDetails?: string
  skipReason?: string
}

export interface RunDeltaCounts {
  regressions: number
  fixes: number
  unchanged: number
}

export interface CaseDeltaEntry {
  testCaseId: string
  caseName: string
}

export interface RunDeltaDetail {
  regressions: CaseDeltaEntry[]
  fixes: CaseDeltaEntry[]
}

export interface RunRecord {
  id: string
  projectId: string
  organizationId: string
  suiteId: string
  name: string
  status: RunStatus
  source: RunSource
  externalId: string
  startedAt: string
  finishedAt?: string
  executedById?: string
  commitSha?: string
  commitMessage?: string
  commitAuthor?: string
  cases: RunCaseRecord[]
  delta: RunDeltaDetail | null
}

export interface JunitIngestAcceptedRun {
  externalId: string
  suiteName: string
  jobId: string
}

export interface JunitIngestRecord {
  accepted: number
  runs: JunitIngestAcceptedRun[]
}

export interface RunCaseCounts {
  total: number
  pending: number
  running: number
  pass: number
  fail: number
  skip: number
  blocked: number
}

export interface RunSummaryRecord {
  id: string
  projectId: string
  organizationId: string
  suiteId: string
  suiteName: string
  name: string
  status: RunStatus
  source: RunSource
  externalId: string
  startedAt: string
  finishedAt?: string
  executedById?: string
  commitSha?: string
  commitMessage?: string
  commitAuthor?: string
  caseCounts: RunCaseCounts
  passRate: number
  delta: RunDeltaCounts | null
}

export interface RunsPageRecord {
  items: RunSummaryRecord[]
  nextCursor?: string
}

/**
 * Bounded last-run summary used by the suite metrics endpoint. Deliberately
 * narrower than RunSummaryRecord: the metrics query never loads full case
 * lists, only the aggregate passRate for the suite's most recent run.
 */
export interface SuiteMetricsLastRun {
  id: string
  status: RunStatus
  source: RunSource
  startedAt: string
  finishedAt?: string
  /** Fraction 0–1, consistent with RunSummaryRecord.passRate. */
  passRate: number
}

export interface SuiteMetricsEntry {
  suiteId: string
  suiteName: string
  lastRun: SuiteMetricsLastRun | null
  /** Up to 10 most recent run statuses for the suite, oldest first. */
  trend: RunStatus[]
}

export interface SuiteMetricsRecord {
  items: SuiteMetricsEntry[]
}

/**
 * A regression is a RunCase whose status is `fail` in a scanned finished run
 * while the same testCaseId was `pass` in the previous finished run of the
 * same suite. `runsScanned` reports how many of the project's most recent
 * finished runs were considered, regardless of how many regressions matched.
 */
export interface RegressionEntry {
  runId: string
  runName: string
  suiteId: string
  suiteName: string
  testCaseId: string
  caseName: string
  previousRunId: string
  detectedAt: string
}

export interface RegressionsRecord {
  items: RegressionEntry[]
  runsScanned: number
}

export interface CiCommitActivityRecord {
  commitSha: string
  shortSha: string
  status: RunStatus
  lastRunAt: string
  runCount: number
  passedRunCount: number
  commitMessage?: string
  commitAuthor?: string
}

/**
 * Server-computed quality snapshot for an organization, optionally scoped to
 * one project via `?projectId=`. The server owns the clock: `windowDays` is
 * the trailing window used for `runsInWindow`, `passRate`, `passRateTrend`
 * and `defectsDetected`, anchored on the server's own "now" — the client
 * must never compute or assume this window itself.
 */
export interface DashboardSummaryRecord {
  totalProjects: number
  totalSuites: number
  totalRuns: number
  runsInWindow: number
  activeRuns: number
  passRate: number
  passRateTrend: number
  defectsDetected: number
  windowDays: number
  recentRuns: RunSummaryRecord[]
  recentCiCommits: CiCommitActivityRecord[]
}


export type TraceabilityStage = 'scm' | 'proposals' | 'official' | 'runs'

export type TraceabilityStageTotals = Record<TraceabilityStage, number>

export interface TraceabilityDayRecord extends TraceabilityStageTotals {
  date: string
}

export interface TraceabilityCalendarRecord {
  year: number
  timeZone: string
  totals: TraceabilityStageTotals
  days: TraceabilityDayRecord[]
}

export interface Notification {
  id: string
  organizationId: string
  userId: string
  eventType: NotificationEventType
  severity: NotificationSeverity
  payload: Record<string, string | number>
  projectId?: string
  runId?: string
  testCaseId?: string
  ingestionBatchId?: string
  connectionId?: string
  createdAt: string
  readAt?: string
}

export interface NotificationPreference {
  id: string
  userId: string
  organizationId: string
  eventType: NotificationEventType
  channel: NotificationChannel
  enabled: boolean
}

export interface NotificationWebhook {
  id: string
  organizationId: string
  type: NotificationWebhookType
  name: string
  maskedUrl: string
  enabled: boolean
  eventTypes: NotificationEventType[]
  createdAt: string
  updatedAt: string
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Record<
  NotificationEventType,
  Record<NotificationChannel, boolean>
> = {
  run_failed: { in_app: true, email: false, slack: false, discord: false },
  run_completed: { in_app: false, email: false, slack: false, discord: false },
  case_regressed: { in_app: true, email: true, slack: false, discord: false },
  ingestion_failed: { in_app: true, email: false, slack: false, discord: false },
  connection_security: { in_app: true, email: true, slack: false, discord: false },
}

export type ProposalStatus = 'in_review' | 'approved' | 'rejected' | 'changes_requested'
export type ReviewDecisionAction = 'approved' | 'rejected' | 'changes_requested'
export type TraceabilityEntityType = 'code_change' | 'evidence' | 'proposal' | 'test_case' | 'test_case_version' | 'run' | 'run_case' | 'quality_risk'

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
  needsManualReview: boolean
  targetOfficialTestCaseId?: string
  locale?: string | null
  observations?: string[]
  createdAt?: string
}
export type SuiteNameSource = 'ingestion' | 'human' | 'aeris'
export interface SuiteProposal {
  id: string
  projectId: string
  suiteId: string
  suiteName: string
  suiteNameSource: SuiteNameSource
  title: string
  description: string
  status: ProposalStatus
  evidenceId: string
  locale: string | null
  createdAt: string
  decidedAt: string | null
}
export interface SuiteProposalDecision {
  proposalId: string
  applied: boolean
  suiteId: string
  suiteName: string
}
export type DocumentFilesSkipReason = 'no-source-file' | 'already-pending'
export interface DocumentFilesSkip {
  reason: DocumentFilesSkipReason
  count: number
}
export interface DocumentFilesResult {
  filesEnqueued: number
  casesTargeted: number
  casesSkipped: DocumentFilesSkip[]
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

export interface AiCase {
  id: string
  name: string
  steps: string[]
  expectedResult: string
  sourceFile: string
  sourceSnippet: string
  reviewStatus: ReviewStatus
  projectId: string
  source: 'webhook' | 'chat'
  possibleDuplicateOf?: string
  duplicateOfCaseId?: string
  similarityScore?: number
  coverageGapId?: string
}

export type AiProvider = 'claude' | 'gemini'

export interface AiProviderConnection {
  provider: AiProvider
  label: string
  connected: boolean
  maskedKey?: string
  model: string
  connectedAt?: string
}

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

export interface CoverageGap {
  id: string
  projectId: string
  area: string
  description: string
  severity: 'high' | 'medium' | 'low'
  suggestedCaseCount: number
  suggestedCaseId: string
}


export interface GithubIntegration {
  webhookUrl: string
  webhookSecret?: string
  connected: boolean
  repoUrl?: string
}

export type RepoConnectionProvider = 'GITHUB' | 'BITBUCKET'

export interface RepoConnection {
  id: string
  organizationId: string
  provider: RepoConnectionProvider
  name: string
  repo: string
  createdAt: string
  updatedAt: string
}

export interface RepoConnectionWithSecret extends RepoConnection {
  webhookSecret: string
}

export interface AvailableRepo {
  id: string
  fullName: string
  isPrivate: boolean
  defaultBranch: string
  updatedAt: string
}

export interface WebhookSecretView {
  webhookSecret: string
}

export type ConnectionType =
  | 'github'
  | 'bitbucket'
  | 'gitlab'
  | 'slack'
  | 'discord'
  | 'email'
  | 'jira'
  | 'qably'

export type ConnectionStatus = 'pending' | 'connected' | 'disconnected' | 'error'

export interface Connection {
  id: string
  type: ConnectionType
  name: string
  status: ConnectionStatus
  config?: Record<string, string>
  createdAt: string
  lastSyncAt?: string
}

const REGEXP_SPECIALS = /[.+^${}()|[\]\\]/g

const compiledPatterns = new Map<string, RegExp>()

function globToRegExp(pattern: string): RegExp {
  const cached = compiledPatterns.get(pattern)
  if (cached !== undefined) return cached

  let source = ''
  let index = 0

  while (index < pattern.length) {
    const char = pattern.charAt(index)

    if (char === '*' && pattern[index + 1] === '*') {
      if (pattern[index + 2] === '/') {
        source += '(?:.*/)?'
        index += 3
      } else {
        source += '.*'
        index += 2
      }
      continue
    }

    if (char === '*') {
      source += '[^/]*'
      index += 1
      continue
    }

    if (char === '?') {
      source += '[^/]'
      index += 1
      continue
    }

    source += char.replace(REGEXP_SPECIALS, '\\$&')
    index += 1
  }

  const expression = new RegExp(`^${source}$`)
  compiledPatterns.set(pattern, expression)
  return expression
}

export function matchDeclaredTestPattern(
  filePath: string,
  patterns: readonly string[],
): string | undefined {
  const normalizedPath = filePath.replaceAll('\\', '/')
  const fileName = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1)

  return patterns.find((pattern) =>
    globToRegExp(pattern).test(
      pattern.includes('/') ? normalizedPath : fileName,
    ),
  )
}

export interface RepositorySource {
  provider: RepoConnectionProvider
  repo: string
  testFilePatterns: string[]
  hasAccessToken: boolean
}

export interface ProjectRepositoryView {
  source: RepositorySource | null
  batch: IngestionBatch | null
  codeChanges: CodeChange[]
  evidence: Evidence[]
}

export const ASSISTANT_MODEL_NAME = 'Aeris 1.2'

export type ChatRole = 'user' | 'assistant'

export interface SuggestedCaseRecord {
  title: string
  objective: string
  preconditions: string[]
  steps: string[]
  expectedResult: string
  priority: CasePriority
}

export interface ChatThreadRecord {
  id: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessageRecord {
  id: string
  threadId: string
  role: ChatRole
  content: string
  suggestedCases: SuggestedCaseRecord[]
  createdAt: string
  sentProposalIds?: Record<number, string>
}

export interface ChatThreadDetailRecord extends ChatThreadRecord {
  messages: ChatMessageRecord[]
}

export interface ChatSendToReviewRecord {
  proposalId: string
  alreadySent?: boolean
}
