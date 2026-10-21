import type { CaseDocumentationState, SuiteDocumentationState } from './documentation-completeness'
import type { DashboardPeriod } from './dashboard-period'
import type { PublicPlanLimits } from './plans'

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
  | 'proposals_ready'
export type NotificationWebhookType = 'slack' | 'discord'
export type NotificationDeliveryStatus = 'sent' | 'failed'
export type ConnectionSecurityAction = 'created' | 'rotated' | 'removed'

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

export type OrgInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface InvitePreviewRecord {
  organizationName: string
  inviterName: string
  email: string
  role: OrgRole
  status: OrgInviteStatus
}

export interface OrganizationUsageRecord {
  plan: Plan
  limits: PublicPlanLimits
  members: number
  pendingInvites: number
  projects: number
  aiEnabled: boolean
  aiCreditsUsed: number
  creditsResetAt: string
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
  | 'flaky'
  | 'duplicate-key'
  | 'near-duplicate-title'

export type CaseHealthSummary = Partial<Record<CaseHealthSignal, number>>

export interface TestCase {
  id: string
  suiteId: string
  version: number | null
  name: string
  objective: string
  preconditions: string[]
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
  localeStale?: boolean
  observations?: string[]
  documentation?: CaseDocumentationState
}

export type CaseCollisionKind = 'identity' | 'legacy_key'

/**
 * An open case identity collision of a suite. `identity`: two tests in one
 * report resolve to the same key. `legacy_key`: an older case is keyed by a
 * bare test name that several classes report.
 */
export interface SuiteCollision {
  id: string
  kind: CaseCollisionKind
  key: string
  claimantCount: number
  /** The first few claimants, named as a person would; `claimantCount` is the total. */
  claimants: string[]
  lastSeenAt: string
  lastRunId: string | null
}

export interface Suite {
  id: string
  projectId: string
  organizationId: string
  name: string
  cases: TestCase[]
  manualCases: number
  automatedCases: number
  undocumentedCount: number
  staleLocaleCount: number
  incompleteCount: number
  createdAt: string
  description: string
  tags: string[]
  isDefault: boolean
  updatedAt: string
  healthSummary?: CaseHealthSummary
  documentation?: SuiteDocumentationState
  openCollisions?: number
  /** The open collisions themselves; only the single-suite view carries them. */
  collisions?: SuiteCollision[]
  /** Proposals of this suite waiting in the review inbox that would create a new case. */
  newCaseProposals?: number
}

/**
 * The catalog case a run case is linked to. `name`, `steps`, `expectedResult`
 * and `executedVersion` are the content the run executed, read from the
 * snapshot taken at that time; rows recorded before snapshots existed fall back
 * to the live case. Every other field describes the case as it is today.
 */
export interface RunCaseOfficialCase {
  id: string
  suiteId: string
  /** The catalog version in force today. */
  version: number | null
  /** The catalog version the run executed, or null when the case had none. */
  executedVersion: number | null
  name: string
  steps: string[]
  expectedResult: string
  /** Whether the live case has steps or an expected result today. */
  documented: boolean
  executionMode: ExecutionMode
  automationKey?: string
  automationClassName?: string
  automationFilePath?: string
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

/**
 * Why no commit range could be proven between two runs. The recorded push
 * history is the only evidence, so each reason names what it was missing.
 */
export type RunAttributionUnknownReason =
  | 'no_commit_reported'
  | 'no_repository_connected'
  | 'commit_not_in_history'
  | 'different_branch'
  | 'history_gap'
  | 'history_rewritten'
  | 'out_of_order'
  | 'range_too_large'

/** A commit pushed between two runs. A candidate, never a proven cause. */
export interface AttributedCommit {
  sha: string
  message: string
  author: string
  /** ISO timestamp of the commit, or null when the provider did not report it. */
  committedAt: string | null
  url: string | null
  /** Branch of the push this commit was read from. */
  branch: string
}

/**
 * The commits pushed between a baseline run and a later run. `range` lists
 * candidates oldest first, with the baseline excluded and the later run's
 * commit included. `unknown` means the recorded history could not prove a
 * chain; it is not an empty range.
 */
export type RunAttribution =
  | { kind: 'same_commit'; sha: string }
  | {
      kind: 'range'
      baseSha: string
      headSha: string
      commits: AttributedCommit[]
    }
  | { kind: 'unknown'; reason: RunAttributionUnknownReason }

export interface RunDeltaDetail {
  regressions: CaseDeltaEntry[]
  fixes: CaseDeltaEntry[]
  /**
   * Commits pushed between the baseline run and this run. Null only when it
   * was not computed: the delta has no regressions and no fixes, or the
   * computation failed.
   */
  attribution: RunAttribution | null
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
  ciRunId?: string
  cases: RunCaseRecord[]
  delta: RunDeltaDetail | null
}

export interface JunitIngestAcceptedRun {
  externalId: string
  suiteName: string
  jobId: string
}

export interface JunitIngestRejectedGroup {
  suiteName: string
  reason: string
}

export interface JunitIngestCaseIdentityCollision {
  suiteName: string
  key: string
  count: number
}

export interface JunitIngestRecord {
  accepted: number
  runs: JunitIngestAcceptedRun[]
  rejected: JunitIngestRejectedGroup[]
  caseIdentityCollisions: JunitIngestCaseIdentityCollision[]
  truncatedFields: Record<string, number>
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
  reportExternalId: string
  startedAt: string
  finishedAt?: string
  executedById?: string
  commitSha?: string
  commitMessage?: string
  commitAuthor?: string
  caseCounts: RunCaseCounts
  /** Fraction 0–1. `null` when the run has no decided case yet. */
  passRate: number | null
  delta: RunDeltaCounts | null
}

export interface RunsPageRecord {
  items: RunSummaryRecord[]
  nextCursor?: string
}

export type CiRunStatus = 'failing' | 'passing'

export interface CiRunSummaryRecord {
  id: string
  projectId: string
  source: RunSource
  externalId: string
  status: CiRunStatus
  startedAt: string
  lastReportedAt: string
  workflowName?: string
  runNumber?: number
  runAttempt?: number
  branch?: string
  headRef?: string
  actor?: string
  eventName?: string
  serverUrl?: string
  repository?: string
  commitSha?: string
  commitMessage?: string
  commitAuthor?: string
}

export interface CiRunsPageRecord {
  items: CiRunSummaryRecord[]
  nextCursor?: string
}

export interface CiRunJobRunRecord {
  id: string
  suiteId: string
  suiteName: string
  name: string
  status: RunStatus
  startedAt: string
  ciJobKey?: string
  reportExternalId?: string
}

export interface CiRunDetailRecord extends CiRunSummaryRecord {
  runs: CiRunJobRunRecord[]
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
  /**
   * Commits pushed between the previous run and the run that detected the
   * regression. Null only when the computation failed.
   */
  attribution: RunAttribution | null
}

export interface RegressionsRecord {
  items: RegressionEntry[]
  runsScanned: number
}

export interface PushPassRateCandle {
  commitSha: string
  shortSha: string
  startedAt: string
  open: number
  close: number
  high: number
  low: number
  runCount: number
  passRate: number
  executed: number
  passed: number
  failed: number
  blocked: number
}

export interface PushPassRateRecord {
  items: PushPassRateCandle[]
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
  /** Fraction 0–1. `null` when no case in the window has been decided yet. */
  passRate: number | null
  /** `null` when the current or previous window's rate is not measured. */
  passRateTrend: number | null
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

export interface KpiMetric {
  value: number | null
  previous: number | null
  series: (number | null)[]
}

export interface DailyPoint {
  date: string
  /** Last day covered by this bucket. Equal to `date` when the granularity is daily. */
  rangeEnd: string
  passRate: number | null
  runs: number
  failedRuns: number
  executed: number
  passed: number
  failed: number
  blocked: number
}

export interface DashboardProjectRow {
  id: string
  name: string
  suites: number
  cases: number
  passRate: number | null
  lastRunAt?: string
}

export interface DashboardRecentRun {
  id: string
  projectId: string
  projectName: string
  suiteId: string
  suiteName: string
  name: string
  status: RunStatus
  source: RunSource
  startedAt: string
  finishedAt?: string
  commitSha?: string
  commitMessage?: string
  commitAuthor?: string
  passRate: number | null
  casesPassed: number
  casesTotal: number
}

export interface DashboardActivityBase {
  projectId: string
  projectName: string
  status: RunStatus
  source: RunSource
  occurredAt: string
  casesPassed: number
  casesTotal: number
}

export interface DashboardCommitActivity extends DashboardActivityBase {
  kind: 'commit'
  commitSha: string
  commitMessage?: string
  commitAuthor?: string
  suiteCount: number
}

export interface DashboardRunActivity extends DashboardActivityBase {
  kind: 'run'
  runId: string
  runName: string
  suiteName: string
}

export type DashboardActivityEntry = DashboardCommitActivity | DashboardRunActivity

export interface DashboardOverviewKpis {
  passRate: KpiMetric
  runs: KpiMetric
  failedCases: KpiMetric
  avgRunDurationMs: KpiMetric
}

export interface CasePriorityCounts {
  critical: number
  high: number
  medium: number
  low: number
}

export interface DashboardOverviewRecord {
  period: DashboardPeriod
  timeZone: string
  kpis: DashboardOverviewKpis
  passRateSeries: {
    current: DailyPoint[]
    previous: DailyPoint[]
    /** Bucket granularity resolved from `period` — 'week' when period is 90, 'day' otherwise. */
    granularity: 'day' | 'week'
  }
  casesPassing: RunCaseCounts
  casePriorities: CasePriorityCounts
  projects: DashboardProjectRow[]
  recentActivity: DashboardActivityEntry[]
}

export interface DashboardChannelDailyPoint {
  date: string
  sent: number
  failed: number
}

export interface DashboardWebhookChannel {
  id: string
  type: NotificationWebhookType
  name: string
  eventTypes: NotificationEventType[]
  sent: number
  failed: number
  daily: DashboardChannelDailyPoint[]
}

export interface DashboardEmailChannel {
  enabled: boolean
  eventTypes: NotificationEventType[]
  sent: number
  failed: number
  daily: DashboardChannelDailyPoint[]
}

export interface DashboardLastDelivery {
  webhookId: string | null
  channel: NotificationChannel
  eventType: NotificationEventType
  status: NotificationDeliveryStatus
  deliveredAt: string
}

export interface DashboardInAppChannel {
  sent: number
  unread: number
  daily: DashboardChannelDailyPoint[]
}

export interface DashboardChannelsRecord {
  webhooks: DashboardWebhookChannel[]
  email: DashboardEmailChannel
  inApp: DashboardInAppChannel
  lastDelivery: DashboardLastDelivery | null
}

export interface NotificationDelivery {
  channel: NotificationWebhookType
  status: NotificationDeliveryStatus
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
  deliveries: NotificationDelivery[]
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
  proposals_ready: { in_app: true, email: false, slack: false, discord: false },
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
  branch?: string | null
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
  targetOfficialTestCaseSuiteId?: string
  locale?: string | null
  observations?: string[]
  createdAt?: string
}
/**
 * Why a proposal is in the review inbox. A push proposal was extracted by Aeris
 * from a test file the push changed; the push fields are null when the event
 * that delivered it is no longer stored.
 */
export type ProposalOrigin =
  | {
      kind: 'push'
      commitSha: string | null
      commitTitle: string | null
      author: string | null
      branch: string | null
      pullRequestNumber: number | null
    }
  | { kind: 'documentation' }
  | { kind: 'case-documentation' }
  | { kind: 'chat' }
export type DocumentFilesSkipReason =
  | 'no-source-file'
  | 'no-automation-key'
  | 'already-pending'
  | 'human-documented'
export interface DocumentFilesSkip {
  reason: DocumentFilesSkipReason
  count: number
}
export interface ConfirmDocumentationResult {
  suiteId: string
  confirmedCaseIds: string[]
  confirmedCount: number
  skippedCaseIds: string[]
  skippedCount: number
  documentationConfirmedAt: string
  documentationConfirmedById: string
}
export interface DocumentFilesResult {
  filesEnqueued: number
  casesTargeted: number
  casesSkipped: DocumentFilesSkip[]
  suiteQueued?: boolean
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
export type ReviewApprovalConflictCode =
  | 'name-taken'
  | 'automation-key-taken'
  | 'publish-conflict'
export interface ReviewConflictingCase {
  id: string
  name: string
  suiteId: string
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
  documentsCaseId?: string
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
  targetTestCaseId?: string
}

export const MAX_ATTACHED_CASES = 5

export interface AttachedCaseRecord {
  id: string
  name: string
  suiteName: string
}

export interface ChatThreadRecord {
  id: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
}

export type GroundingReferenceKind =
  | 'source-excerpt'
  | 'code-change'
  | 'review'
  | 'attached-file'

export interface GroundingReference {
  kind: GroundingReferenceKind
  id: string
}

export type GroundingView =
  | { status: 'grounded'; references: GroundingReference[] }
  | { status: 'insufficient' }

export interface ChatMessageRecord {
  id: string
  threadId: string
  role: ChatRole
  content: string
  suggestedCases: SuggestedCaseRecord[]
  attachedCases?: AttachedCaseRecord[]
  attachedFilePath?: string | null
  grounding?: GroundingView | null
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

export * from './documentation-completeness'
export * from './pass-rate'
export * from './dashboard-period'
export * from './plans'
export * from './is-safe-repo-relative-path'
export * from './default-test-file-patterns'
export * from './suite-run-status'
export * from './suite-summaries'
