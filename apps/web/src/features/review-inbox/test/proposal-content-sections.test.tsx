import { render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import type { ExtractedProposal } from '@qably/types'
import { useI18nStore } from '@/lib/i18n'
import { ProposalContentSections } from '../components/inspector/proposal-content-sections'
import type { PublishedVersionView } from '../api/review.api'

function proposal(overrides: Partial<ExtractedProposal> = {}): ExtractedProposal {
  return {
    id: 'proposal-1',
    projectId: 'project-1',
    status: 'in_review',
    title: 'Empties the cart',
    objective: 'Confirm the cart resets',
    preconditions: ['A signed-in user'],
    steps: ['Open the cart', 'Remove every item'],
    expectedResult: 'The cart shows zero items',
    priority: 'medium',
    evidenceId: 'evidence-1',
    needsManualReview: false,
    ...overrides,
  }
}

function publishedVersion(overrides: Partial<PublishedVersionView> = {}): PublishedVersionView {
  return {
    version: 2,
    title: 'Empties the cart',
    objective: 'Confirm the cart resets',
    preconditions: ['A signed-in user'],
    steps: ['Open the cart', 'Remove every item'],
    expectedResult: 'The cart shows zero items',
    publishedAt: '2026-09-01T10:00:00.000Z',
    publishedBy: null,
    ...overrides,
  }
}

describe('ProposalContentSections diff vs published version', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders no diff block when there is nothing to compare against', () => {
    render(
      <ProposalContentSections proposal={proposal()} needsManualReview={false} publishedVersion={null} />,
    )

    expect(screen.queryByText(/Changes from published version/)).not.toBeInTheDocument()
  })

  it('reports no changes when the proposal matches the published version', () => {
    render(
      <ProposalContentSections
        proposal={proposal()}
        needsManualReview={false}
        publishedVersion={publishedVersion()}
      />,
    )

    expect(screen.getByText('Changes from published version 2')).toBeInTheDocument()
    expect(screen.getByText('No changes from the published version.')).toBeInTheDocument()
  })

  it('shows the previous and next value for a changed scalar field', () => {
    render(
      <ProposalContentSections
        proposal={proposal({ objective: 'Confirm the cart is empty' })}
        needsManualReview={false}
        publishedVersion={publishedVersion()}
      />,
    )

    const previous = screen.getByText('Confirm the cart resets')
    expect(previous.tagName).toBe('DEL')

    const nextMatches = screen.getAllByText('Confirm the cart is empty')
    expect(nextMatches.some((el) => el.tagName === 'INS')).toBe(true)
  })

  it('shows added and removed steps without flagging unchanged ones', () => {
    render(
      <ProposalContentSections
        proposal={proposal({ steps: ['Open the cart', 'Apply a coupon'] })}
        needsManualReview={false}
        publishedVersion={publishedVersion()}
      />,
    )

    const removed = screen.getByText('Remove every item')
    expect(removed.tagName).toBe('DEL')

    const addedMatches = screen.getAllByText('Apply a coupon')
    expect(addedMatches.some((el) => el.tagName === 'INS')).toBe(true)
  })

  it('shows added and removed preconditions independently from steps', () => {
    render(
      <ProposalContentSections
        proposal={proposal({ preconditions: ['A signed-in admin'] })}
        needsManualReview={false}
        publishedVersion={publishedVersion()}
      />,
    )

    const removed = screen.getByText('A signed-in user')
    expect(removed.tagName).toBe('DEL')

    const addedMatches = screen.getAllByText('A signed-in admin')
    expect(addedMatches.some((el) => el.tagName === 'INS')).toBe(true)
  })
})
