import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExtractedProposal } from '@qably/types'
import { DecisionToolbar } from '../components/inspector/decision-toolbar'
import type { ProposalClassification } from '../api/review.api'
import { useI18nStore } from '@/lib/i18n'

function proposal(overrides: Partial<ExtractedProposal> = {}): ExtractedProposal {
  return {
    id: 'proposal-1',
    projectId: 'project-1',
    status: 'in_review',
    title: 'Empties the cart',
    objective: 'Confirm the cart resets',
    preconditions: [],
    steps: ['Open the cart', 'Remove every item'],
    expectedResult: 'The cart shows zero items',
    priority: 'medium',
    evidenceId: 'evidence-1',
    needsManualReview: false,
    ...overrides,
  }
}

function classification(overrides: Partial<ProposalClassification> = {}): ProposalClassification {
  return {
    kind: 'none',
    matchedCaseId: null,
    matchedCaseName: null,
    matchedCaseSuiteId: null,
    score: null,
    reasons: [],
    ...overrides,
  }
}

const possibleDuplicate = classification({
  kind: 'possible_duplicate',
  matchedCaseId: 'case-9',
  matchedCaseName: 'Checks the cart',
  matchedCaseSuiteId: 'suite-1',
  score: 0.72,
  reasons: ['same-title'],
})

function renderToolbar(
  overrides: {
    proposal?: ExtractedProposal
    classification?: ProposalClassification
  } = {},
) {
  const onApprove = vi.fn()
  const onReject = vi.fn()

  render(
    <DecisionToolbar
      proposal={overrides.proposal ?? proposal()}
      project={{ id: 'project-1' }}
      classification={overrides.classification ?? classification()}
      onApprove={onApprove}
      onReject={onReject}
      isSubmitting={false}
    />,
  )

  return { onApprove, onReject }
}

describe('DecisionToolbar', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('offers a single approval when nothing needs choosing', async () => {
    const user = userEvent.setup()
    const { onApprove } = renderToolbar()

    await user.click(screen.getByRole('button', { name: 'Approve & publish' }))

    expect(onApprove).toHaveBeenCalledWith('proposal-1')
    expect(screen.queryByRole('group', { name: 'Approve as' })).not.toBeInTheDocument()
  })

  it('keeps a single approval for a proposal that already updates a case', () => {
    renderToolbar({
      classification: classification({
        kind: 'update',
        matchedCaseId: 'case-9',
        matchedCaseName: 'Checks the cart',
        matchedCaseSuiteId: 'suite-1',
      }),
    })

    expect(screen.getByRole('button', { name: 'Approve & publish' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Approve as' })).not.toBeInTheDocument()
  })

  it('keeps a single approval when the matched case is gone', () => {
    renderToolbar({
      classification: classification({ kind: 'possible_duplicate', score: 0.7 }),
    })

    expect(screen.getByRole('button', { name: 'Approve & publish' })).toBeInTheDocument()
  })

  it('asks a possible duplicate to be approved as an update or as a new case, never silently', () => {
    renderToolbar({ classification: possibleDuplicate })

    const choice = screen.getByRole('group', { name: 'Approve as' })

    expect(screen.queryByRole('button', { name: 'Approve & publish' })).not.toBeInTheDocument()
    expect(choice).toContainElement(screen.getByRole('button', { name: 'Update case Checks the cart' }))
    expect(choice).toContainElement(screen.getByRole('button', { name: 'Create new case' }))
  })

  it('applies the proposal to the matched case when asked to update it', async () => {
    const user = userEvent.setup()
    const { onApprove } = renderToolbar({ classification: possibleDuplicate })

    await user.click(screen.getByRole('button', { name: 'Update case Checks the cart' }))

    expect(onApprove).toHaveBeenCalledWith('proposal-1', 'matched-case')
  })

  it('creates a new case when asked to', async () => {
    const user = userEvent.setup()
    const { onApprove } = renderToolbar({ classification: possibleDuplicate })

    await user.click(screen.getByRole('button', { name: 'Create new case' }))

    expect(onApprove).toHaveBeenCalledWith('proposal-1', 'new-case')
  })

  it('reaches both choices and the rejection with the keyboard, in reading order', async () => {
    const user = userEvent.setup()
    const { onApprove } = renderToolbar({ classification: possibleDuplicate })

    await user.tab()
    expect(screen.getByRole('button', { name: 'Update case Checks the cart' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Create new case' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Reject' })).toHaveFocus()

    await user.tab({ shift: true })
    await user.tab({ shift: true })
    await user.keyboard('{Enter}')
    expect(onApprove).toHaveBeenCalledWith('proposal-1', 'matched-case')
  })

  it('names the matched case in the accessible name even when the label is truncated', () => {
    renderToolbar({
      classification: { ...possibleDuplicate, matchedCaseName: 'Checks the cart total' },
    })

    expect(
      screen.getByRole('button', { name: 'Update case Checks the cart total' }),
    ).toHaveAttribute('title', 'Update case Checks the cart total')
  })

  it('falls back to an unnamed label when the matched case name is unknown', () => {
    renderToolbar({ classification: { ...possibleDuplicate, matchedCaseName: null } })

    expect(screen.getByRole('button', { name: 'Update the matched case' })).toBeInTheDocument()
  })

  it('disables every approval for a proposal with nothing to publish', () => {
    renderToolbar({
      proposal: proposal({ steps: [] }),
      classification: possibleDuplicate,
    })

    expect(screen.getByRole('button', { name: 'Update case Checks the cart' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create new case' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled()
  })

  it('shows the decision instead of the actions once the proposal is decided', () => {
    renderToolbar({
      proposal: proposal({ status: 'approved' }),
      classification: possibleDuplicate,
    })

    expect(screen.queryByRole('group', { name: 'Approve as' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
  })
})
