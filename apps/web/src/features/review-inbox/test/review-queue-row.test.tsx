import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ProposalListItem } from '../api/review.api'
import { ReviewQueueRow } from '../components/review-queue-row'

function proposal(overrides: Partial<ProposalListItem> = {}): ProposalListItem {
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
    evidenceTitle: 'src/cart.spec.ts',
    needsManualReview: false,
    ...overrides,
  }
}

describe('ReviewQueueRow', () => {
  it('renders a source-unavailable http-404 reason as plain language, never the raw code', () => {
    render(
      <ReviewQueueRow
        proposal={proposal({
          needsManualReview: true,
          steps: [],
          objective: 'http-404',
        })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.queryByText('http-404')).not.toBeInTheDocument()
    expect(
      screen.getByText(/could not be found at that commit|no se pudo encontrar/i),
    ).toBeInTheDocument()
  })

  it('shows an update badge, never "possible duplicate", when the persisted classification is update', () => {
    render(
      <ReviewQueueRow
        proposal={proposal({
          classification: {
            kind: 'update',
            matchedCaseId: 'case-1',
            matchedCaseName: null,
            matchedCaseSuiteId: null,
            score: 1,
            reasons: ['same-automation-key'],
          },
        })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('Updates an existing case in this suite')).toBeInTheDocument()
    expect(screen.queryByText('Possible duplicate')).not.toBeInTheDocument()
  })

  it('shows a possible-duplicate badge scoped to the suite when the persisted classification says so', () => {
    render(
      <ReviewQueueRow
        proposal={proposal({
          classification: {
            kind: 'possible_duplicate',
            matchedCaseId: 'case-2',
            matchedCaseName: null,
            matchedCaseSuiteId: null,
            score: 0.72,
            reasons: ['same-title'],
          },
        })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Possible duplicate of an existing case in this suite'),
    ).toBeInTheDocument()
  })

  it('names the matched case in the update badge when the name is known', () => {
    render(
      <ReviewQueueRow
        proposal={proposal({
          classification: {
            kind: 'update',
            matchedCaseId: 'case-1',
            matchedCaseName: 'Empties the cart',
            matchedCaseSuiteId: null,
            score: 1,
            reasons: ['same-automation-key'],
          },
        })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('Updates Empties the cart')).toBeInTheDocument()
  })

  it('names the matched case in the possible-duplicate badge when the name is known', () => {
    render(
      <ReviewQueueRow
        proposal={proposal({
          classification: {
            kind: 'possible_duplicate',
            matchedCaseId: 'case-2',
            matchedCaseName: 'Checks the login flow',
            matchedCaseSuiteId: null,
            score: 0.72,
            reasons: ['same-title'],
          },
        })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Possible duplicate of Checks the login flow'),
    ).toBeInTheDocument()
  })

  it('shows neither badge when the classification is absent or none', () => {
    render(
      <ReviewQueueRow proposal={proposal()} isSelected={false} onSelect={vi.fn()} />,
    )

    expect(
      screen.queryByText('Updates an existing case in this suite'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Possible duplicate of an existing case in this suite'),
    ).not.toBeInTheDocument()
  })

  it('hides the date instead of showing a placeholder timestamp when createdAt is missing', () => {
    render(
      <ReviewQueueRow proposal={proposal()} isSelected={false} onSelect={vi.fn()} />,
    )

    expect(screen.queryByText('Sep 9, 01:23 PM')).not.toBeInTheDocument()
  })

  it('renders no placeholder comment count', () => {
    render(
      <ReviewQueueRow proposal={proposal()} isSelected={false} onSelect={vi.fn()} />,
    )

    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})

describe('ReviewQueueRow matched case link', () => {
  const matched = {
    matchedCaseId: 'case-2',
    matchedCaseName: 'Checks the login flow',
    matchedCaseSuiteId: 'suite-7',
    score: 0.72,
    reasons: ['same-title'],
  } as const

  function renderRow(kind: 'update' | 'possible_duplicate', overrides = {}) {
    const onSelect = vi.fn()
    render(
      <ReviewQueueRow
        proposal={proposal({
          classification: { kind, ...matched, reasons: ['same-title'], ...overrides },
        })}
        isSelected={false}
        onSelect={onSelect}
      />,
    )
    return onSelect
  }

  it.each([
    ['possible_duplicate', 'Possible duplicate of Checks the login flow'],
    ['update', 'Updates Checks the login flow'],
  ] as const)('links the %s badge to the matched case in its suite', (kind, label) => {
    renderRow(kind)

    expect(screen.getByRole('link', { name: label })).toHaveAttribute(
      'href',
      '/projects/project-1/suites/suite-7/edit?case=case-2',
    )
  })

  it('keeps the link outside the selection button, since a link cannot live inside a button', () => {
    renderRow('possible_duplicate')

    const link = screen.getByRole('link', { name: /Possible duplicate of/ })

    expect(link.closest('button')).toBeNull()
  })

  it('does not select the row when the badge is used', async () => {
    const user = userEvent.setup()
    const onSelect = renderRow('possible_duplicate')

    await user.click(screen.getByRole('link', { name: /Possible duplicate of/ }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('still selects the row from its button', async () => {
    const user = userEvent.setup()
    const onSelect = renderRow('possible_duplicate')

    await user.click(screen.getByRole('button', { name: /Empties the cart/ }))

    expect(onSelect).toHaveBeenCalledWith('proposal-1')
  })

  it('shows the badge as plain text when the matched case cannot be located', () => {
    renderRow('possible_duplicate', { matchedCaseSuiteId: null })

    expect(screen.getByText('Possible duplicate of Checks the login flow')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('ReviewQueueRow origin', () => {
  function renderRow(overrides: Partial<ProposalListItem>) {
    return render(
      <ReviewQueueRow proposal={proposal(overrides)} isSelected={false} onSelect={vi.fn()} />,
    )
  }

  it('names the push, its short commit and its author for a proposal extracted from a push', () => {
    renderRow({
      origin: {
        kind: 'push',
        commitSha: 'abc1234def5678',
        commitTitle: 'Add cart tests',
        author: 'ana',
        branch: 'main',
        pullRequestNumber: null,
      },
    })

    const origin = screen.getByTestId('proposal-origin')
    expect(origin).toHaveTextContent('Push')
    expect(origin).toHaveTextContent('abc1234')
    expect(origin).not.toHaveTextContent('abc1234def5678')
    expect(origin).toHaveTextContent('ana')
  })

  it('sets only the commit sha in the mono face', () => {
    renderRow({
      origin: {
        kind: 'push',
        commitSha: 'abc1234def5678',
        commitTitle: null,
        author: 'ana',
        branch: null,
        pullRequestNumber: null,
      },
    })

    expect(screen.getByText('abc1234').className).toContain('font-mono')
    expect(screen.getByText('ana').className).not.toContain('font-mono')
  })

  it('names the pull request when the push came through one', () => {
    renderRow({
      origin: {
        kind: 'push',
        commitSha: 'abc1234def5678',
        commitTitle: null,
        author: null,
        branch: null,
        pullRequestNumber: 42,
      },
    })

    expect(screen.getByTestId('proposal-origin')).toHaveTextContent('PR #42')
  })

  it.each([
    ['documentation', 'Aeris documentation'],
    ['case-documentation', 'Case documentation'],
    ['chat', 'Aeris chat'],
  ] as const)('names a %s origin in plain words', (kind, label) => {
    renderRow({ origin: { kind } })

    expect(screen.getByTestId('proposal-origin')).toHaveTextContent(label)
  })

  it('shows no origin line when the payload has none', () => {
    renderRow({})

    expect(screen.queryByTestId('proposal-origin')).not.toBeInTheDocument()
  })
})
