import { describe, expect, it } from 'vitest'
import {
  getCaseLifecyclePresentation,
  getCiRunStatusPresentation,
  getExecutionStatusPresentation,
  getLegacyStatusPresentation,
  getReviewStatusPresentation,
} from './status-presentation'
import {
  CheckCircle,
  MinusCircle,
  ProhibitInset,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react'

describe('status presentation registry', () => {
  it('maps execution statuses to explicit visual and accessible intent', () => {
    const presentation = getExecutionStatusPresentation('blocked')

    expect(presentation).toMatchObject({
      labelKey: 'status.execution.blocked',
      tone: 'blocked',
      status: 'blocked',
    })
    expect(presentation.Icon).toBeDefined()
  })

  it('keeps review and lifecycle vocabularies scoped to their domain contracts', () => {
    expect(getReviewStatusPresentation('confirmed')).toMatchObject({
      labelKey: 'status.review.confirmed',
      tone: 'pass',
    })
    expect(getCaseLifecyclePresentation('deprecated')).toMatchObject({
      labelKey: 'status.lifecycle.deprecated',
      tone: 'muted',
    })
  })

  it('preserves explicit legacy presentations for unscoped consumers', () => {
    expect(getLegacyStatusPresentation('cancelled')).toMatchObject({
      status: 'cancelled',
      labelKey: 'status.legacy.cancelled',
      tone: 'muted',
      Icon: ProhibitInset,
    })
    expect(getLegacyStatusPresentation('draft')).toMatchObject({
      status: 'draft',
      labelKey: 'status.lifecycle.draft',
      tone: 'warn',
      Icon: WarningCircle,
    })
    expect(getLegacyStatusPresentation('deprecated')).toMatchObject({
      status: 'deprecated',
      labelKey: 'status.lifecycle.deprecated',
      tone: 'muted',
      Icon: MinusCircle,
    })
  })

  it('maps a failing CI run to the fail tone with a cross icon', () => {
    expect(getCiRunStatusPresentation('failing')).toMatchObject({
      status: 'failing',
      labelKey: 'status.ciRun.failing',
      tone: 'fail',
      Icon: XCircle,
    })
  })

  it('maps a passing CI run to the pass tone with a check icon', () => {
    expect(getCiRunStatusPresentation('passing')).toMatchObject({
      status: 'passing',
      labelKey: 'status.ciRun.passing',
      tone: 'pass',
      Icon: CheckCircle,
    })
  })
})
