import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { ExtractedProposal } from '@qably/types'
import { ReviewProposalInspector } from '../components/review-proposal-inspector'
import { __resetStore } from '@/lib/mock-store'
import { useI18nStore } from '@/lib/i18n'
import { renderWithQuery } from '@/lib/query-test-utils'
import * as suitesApi from '@/test/suites-api-stub'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

vi.mock('@/lib/notify', () => ({
  notify: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}))

function proposal(
  overrides: Partial<ExtractedProposal> = {},
): ExtractedProposal {
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

function renderInspector(value: ExtractedProposal) {
  return renderWithQuery(
    <ReviewProposalInspector
      proposal={value}
      onApprove={vi.fn()}
      onReject={vi.fn()}
    />,
  )
}

describe('ReviewProposalInspector', () => {
  beforeEach(() => {
    __resetStore()
    useI18nStore.setState({ locale: 'en' })
  })

  it('documents the steps and expected result of a complete proposal', () => {
    renderInspector(proposal())

    expect(screen.getByText('Steps')).toBeInTheDocument()
    expect(screen.getByText('Open the cart')).toBeInTheDocument()
    expect(screen.getByText('Expected result')).toBeInTheDocument()
    expect(screen.getByText('The cart shows zero items')).toBeInTheDocument()
  })

  it('explains a flagged proposal instead of rendering empty sections', () => {
    renderInspector(
      proposal({
        needsManualReview: true,
        objective: 'no-tests-found',
        steps: [],
        expectedResult: '',
      }),
    )

    expect(
      screen.getByText(/No test declarations were found in this file/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Steps')).not.toBeInTheDocument()
    expect(screen.queryByText('Expected result')).not.toBeInTheDocument()
  })

  it('shows the raw reason when the extraction reported something untranslated', () => {
    renderInspector(
      proposal({
        needsManualReview: true,
        objective: 'invalid-credentials',
        steps: [],
        expectedResult: '',
      }),
    )

    expect(screen.getByText(/invalid-credentials/)).toBeInTheDocument()
  })

  it('refuses to offer publication for a proposal with nothing to publish', () => {
    renderInspector(
      proposal({ needsManualReview: true, steps: [], expectedResult: '' }),
    )

    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /reject/i })).toBeEnabled()
  })

  it('keeps publication available for a documented proposal', () => {
    renderInspector(proposal())

    expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled()
  })

  it('gives the options button a descriptive accessible name, not a generic one', () => {
    renderInspector(proposal())

    expect(screen.getByRole('button', { name: 'Proposal options' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Opciones' })).not.toBeInTheDocument()
  })

  describe('re-documenting an incomplete extraction', () => {
    it('offers to document again when the target case is known', () => {
      renderInspector(
        proposal({
          needsManualReview: true,
          objective: 'extraction-incomplete',
          steps: [],
          expectedResult: '',
          targetOfficialTestCaseId: 'case-1',
          targetOfficialTestCaseSuiteId: 'suite-1',
        }),
      )

      expect(
        screen.getByRole('button', { name: /document again with aeris/i }),
      ).toBeInTheDocument()
    })

    it('offers nothing when the proposal carries no target case', () => {
      renderInspector(
        proposal({
          needsManualReview: true,
          objective: 'extraction-incomplete',
          steps: [],
          expectedResult: '',
        }),
      )

      expect(
        screen.queryByRole('button', { name: /document again with aeris/i }),
      ).not.toBeInTheDocument()
    })

    it('offers nothing for a different manual-review reason', () => {
      renderInspector(
        proposal({
          needsManualReview: true,
          objective: 'no-tests-found',
          steps: [],
          expectedResult: '',
          targetOfficialTestCaseId: 'case-1',
          targetOfficialTestCaseSuiteId: 'suite-1',
        }),
      )

      expect(
        screen.queryByRole('button', { name: /document again with aeris/i }),
      ).not.toBeInTheDocument()
    })

    it('queues the target case for re-documentation when clicked', async () => {
      const documentCase = vi.spyOn(suitesApi, 'documentCase')
      const user = userEvent.setup()

      await act(async () => {
        renderInspector(
          proposal({
            needsManualReview: true,
            objective: 'extraction-incomplete',
            steps: [],
            expectedResult: '',
            targetOfficialTestCaseId: 'case-1',
            targetOfficialTestCaseSuiteId: 'suite-1',
          }),
        )
      })

      await user.click(
        screen.getByRole('button', { name: /document again with aeris/i }),
      )

      expect(documentCase).toHaveBeenCalledWith('suite-1', 'case-1')
    })
  })
})
