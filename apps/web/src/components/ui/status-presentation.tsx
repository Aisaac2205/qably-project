import {
  CheckCircle,
  Circle,
  CircleNotch,
  Clock,
  MinusCircle,
  Prohibit,
  ProhibitInset,
  WarningCircle,
  XCircle,
  type Icon,
} from '@phosphor-icons/react'
import type { CaseState, CaseStatus, ReviewStatus, RunStatus, SuiteRunStatus } from '@qably/types'

export type ExecutionStatus = CaseStatus | RunStatus | SuiteRunStatus
export type LegacyStatus = ExecutionStatus | 'cancelled' | CaseState
export type StatusTone = 'pass' | 'fail' | 'blocked' | 'running' | 'muted' | 'warn'

export interface StatusPresentation<Status extends string = string> {
  status: Status
  labelKey: string
  tone: StatusTone
  Icon: Icon
  animated?: boolean
}

type StatusPresentationRegistry<Status extends string> = {
  [Key in Status]: StatusPresentation<Key>
}

export const statusToneClassNames: Record<StatusTone, string> = {
  pass: 'bg-pass-bg text-pass',
  fail: 'bg-fail-bg text-fail',
  blocked: 'bg-blocked-bg text-blocked',
  running: 'bg-running-bg text-running',
  muted: 'bg-skip-bg text-muted',
  warn: 'bg-warn-bg text-warn',
}

const executionStatusPresentations = {
  pass: { status: 'pass', labelKey: 'status.execution.pass', tone: 'pass', Icon: CheckCircle },
  fail: { status: 'fail', labelKey: 'status.execution.fail', tone: 'fail', Icon: XCircle },
  skip: { status: 'skip', labelKey: 'status.execution.skip', tone: 'muted', Icon: MinusCircle },
  blocked: { status: 'blocked', labelKey: 'status.execution.blocked', tone: 'blocked', Icon: Prohibit },
  running: { status: 'running', labelKey: 'status.execution.running', tone: 'running', Icon: CircleNotch, animated: true },
  pending: { status: 'pending', labelKey: 'status.execution.pending', tone: 'muted', Icon: Clock },
  'needs-attention': { status: 'needs-attention', labelKey: 'status.execution.needsAttention', tone: 'warn', Icon: WarningCircle },
  'never-run': { status: 'never-run', labelKey: 'status.execution.neverRun', tone: 'muted', Icon: Circle },
} satisfies StatusPresentationRegistry<ExecutionStatus>

const reviewStatusPresentations = {
  pending: { status: 'pending', labelKey: 'status.review.pending', tone: 'muted', Icon: Clock },
  confirmed: { status: 'confirmed', labelKey: 'status.review.confirmed', tone: 'pass', Icon: CheckCircle },
  rejected: { status: 'rejected', labelKey: 'status.review.rejected', tone: 'fail', Icon: XCircle },
} satisfies StatusPresentationRegistry<ReviewStatus>

const caseLifecyclePresentations = {
  active: { status: 'active', labelKey: 'status.lifecycle.active', tone: 'pass', Icon: CheckCircle },
  draft: { status: 'draft', labelKey: 'status.lifecycle.draft', tone: 'warn', Icon: WarningCircle },
  deprecated: { status: 'deprecated', labelKey: 'status.lifecycle.deprecated', tone: 'muted', Icon: MinusCircle },
} satisfies StatusPresentationRegistry<CaseState>

// Preserve the original unscoped API while making every accepted value explicit.
const legacyStatusPresentations = {
  pass: executionStatusPresentations.pass,
  fail: executionStatusPresentations.fail,
  skip: executionStatusPresentations.skip,
  blocked: executionStatusPresentations.blocked,
  running: executionStatusPresentations.running,
  pending: executionStatusPresentations.pending,
  cancelled: {
    status: 'cancelled',
    labelKey: 'status.legacy.cancelled',
    tone: 'muted',
    Icon: ProhibitInset,
  },
  active: caseLifecyclePresentations.active,
  draft: caseLifecyclePresentations.draft,
  deprecated: caseLifecyclePresentations.deprecated,
  'needs-attention': executionStatusPresentations['needs-attention'],
  'never-run': executionStatusPresentations['never-run'],
} satisfies StatusPresentationRegistry<LegacyStatus>

export function getExecutionStatusPresentation(status: ExecutionStatus): StatusPresentation {
  return executionStatusPresentations[status]
}

export function getReviewStatusPresentation(status: ReviewStatus): StatusPresentation {
  return reviewStatusPresentations[status]
}

export function getCaseLifecyclePresentation(status: CaseState): StatusPresentation {
  return caseLifecyclePresentations[status]
}

export function getLegacyStatusPresentation(status: LegacyStatus): StatusPresentation {
  return legacyStatusPresentations[status]
}
