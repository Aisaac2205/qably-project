import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DuplicateComparison } from '@/features/review-inbox/components/duplicate-comparison'
import type { ProposalClassification } from '@/features/review-inbox/api/review.api'

describe('DuplicateComparison', () => {
  it('renders nothing when the classification kind is none', () => {
    const classification: ProposalClassification = {
      kind: 'none',
      matchedCaseId: null,
      matchedCaseName: null,
      score: null,
      reasons: [],
    }

    const { container } = render(<DuplicateComparison classification={classification} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('explains an update classification without ever showing a raw reason code', () => {
    const classification: ProposalClassification = {
      kind: 'update',
      matchedCaseId: 'case-1',
      matchedCaseName: null,
      score: 1,
      reasons: ['same-automation-key'],
    }

    render(<DuplicateComparison classification={classification} />)

    expect(screen.getByText(/updates an existing case in this suite/i)).toBeInTheDocument()
    expect(screen.getByText('Same automation key')).toBeInTheDocument()
    expect(screen.queryByText('same-automation-key')).not.toBeInTheDocument()
  })

  it('explains a possible-duplicate classification with its reasons and a human-readable score', () => {
    const classification: ProposalClassification = {
      kind: 'possible_duplicate',
      matchedCaseId: 'case-2',
      matchedCaseName: null,
      score: 0.72,
      reasons: ['same-title', 'steps-overlap'],
    }

    render(<DuplicateComparison classification={classification} />)

    expect(
      screen.getByText(/possible duplicate of an existing case in this suite/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Same title')).toBeInTheDocument()
    expect(screen.getByText('Similar steps')).toBeInTheDocument()
    expect(screen.getByText('72% match')).toBeInTheDocument()
    expect(screen.queryByText('same-title')).not.toBeInTheDocument()
    expect(screen.queryByText('steps-overlap')).not.toBeInTheDocument()
  })

  it('names the matched case when the name is known', () => {
    const classification: ProposalClassification = {
      kind: 'possible_duplicate',
      matchedCaseId: 'case-2',
      matchedCaseName: 'Checks the login flow',
      score: 0.72,
      reasons: ['same-title'],
    }

    render(<DuplicateComparison classification={classification} />)

    expect(screen.getByText('Possible duplicate of Checks the login flow')).toBeInTheDocument()
  })

  it('labels the reasons list with an accessible heading', () => {
    const classification: ProposalClassification = {
      kind: 'possible_duplicate',
      matchedCaseId: 'case-2',
      matchedCaseName: null,
      score: 0.72,
      reasons: ['same-title', 'steps-overlap'],
    }

    render(<DuplicateComparison classification={classification} />)

    expect(screen.getByRole('list', { name: 'Why' })).toBeInTheDocument()
  })

  it('shows a separate cross-suite note when the automation key also matches in another suite', () => {
    const classification: ProposalClassification = {
      kind: 'update',
      matchedCaseId: 'case-1',
      matchedCaseName: null,
      score: 1,
      reasons: ['same-automation-key', 'cross-suite-key'],
    }

    render(<DuplicateComparison classification={classification} />)

    expect(
      screen.getByText(/this automation key also exists in another suite/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('cross-suite-key')).not.toBeInTheDocument()
  })

  it('omits the cross-suite note when the reason is absent', () => {
    const classification: ProposalClassification = {
      kind: 'update',
      matchedCaseId: 'case-1',
      matchedCaseName: null,
      score: 1,
      reasons: ['same-automation-key'],
    }

    render(<DuplicateComparison classification={classification} />)

    expect(
      screen.queryByText(/this automation key also exists in another suite/i),
    ).not.toBeInTheDocument()
  })
})
