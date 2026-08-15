import { describe, expect, it } from 'vitest'
import {
  getCaseLifecyclePresentation,
  getExecutionStatusPresentation,
  getLegacyStatusPresentation,
  getReviewStatusPresentation,
} from './status-presentation'
import { MinusCircle, ProhibitInset, WarningCircle } from '@phosphor-icons/react'

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
})
