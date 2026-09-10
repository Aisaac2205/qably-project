import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ReviewInboxPage } from '../components/review-inbox-page'
import { __resetStore } from '@/lib/mock-store'
import { useI18nStore } from '@/lib/i18n'
import { renderWithQuery } from '@/lib/query-test-utils'

let searchParamsQuery = ''

vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  usePathname: () => '/review-inbox',
  useRouter: () => ({
    back: () => {},
    forward: () => {},
    prefetch: () => Promise.resolve(),
    push: () => {},
    refresh: () => {},
    replace: () => {},
  }),
  useSearchParams: () => new URLSearchParams(searchParamsQuery),
}))

vi.mock('@/features/review-inbox/api/review.api', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/review-inbox/api/review.api')
  >('@/features/review-inbox/api/review.api')

  return {
    ...actual,
    listSuiteProposals: vi.fn().mockResolvedValue([
      {
        id: 'sp-1',
        projectId: 'proj-1',
        suiteId: 'suite-9',
        suiteName: 'cart.spec.ts',
        suiteNameSource: 'ingestion',
        title: 'Cart suite',
        description: 'Covers the shopping cart',
        status: 'in_review',
        evidenceId: 'ev-1',
        locale: null,
        createdAt: '2026-09-09T10:00:00Z',
        decidedAt: null,
      },
    ]),
    approveSuiteProposal: vi.fn().mockResolvedValue({
      proposalId: 'sp-1',
      projectId: 'proj-1',
      applied: true,
      suiteId: 'suite-9',
      suiteName: 'Cart suite',
    }),
    rejectSuiteProposal: vi.fn().mockResolvedValue({
      proposalId: 'sp-1',
      projectId: 'proj-1',
      applied: false,
      suiteId: 'suite-9',
      suiteName: 'cart.spec.ts',
    }),
    approveProposal: vi.fn().mockResolvedValue({
      createdNewCase: true,
      testCaseId: 'case-1',
      testCaseName: 'Empties the cart',
      suiteId: 'suite-1',
      versionId: 'version-1',
      version: 1,
      decisionId: 'decision-1',
    }),
    rejectProposal: vi.fn().mockResolvedValue({ decisionId: 'decision-1' }),
    approveProposals: vi.fn().mockResolvedValue([
      { id: 'proposal-ai-3', outcome: 'approved' },
      { id: 'proposal-ai-4', outcome: 'skipped', reason: 'incomplete-proposal' },
    ]),
    rejectProposals: vi.fn().mockResolvedValue([{ id: 'proposal-ai-3', outcome: 'rejected' }]),
  }
})

describe('ReviewInboxPage', () => {
  beforeEach(() => {
    __resetStore()
    useI18nStore.setState({ locale: 'en' })
    searchParamsQuery = ''
  })

  describe('?proposal= preselection', () => {
    it('preselects the proposal named in the query param even outside the default filter', async () => {
      searchParamsQuery = 'proposal=proposal-ai-1'

      renderWithQuery(<ReviewInboxPage />)

      expect(
        await screen.findByRole('heading', { name: 'Valid checkout completes order' }),
      ).toBeInTheDocument()
    })

    it('does not re-apply the query preselection on a later re-render of the same mount', async () => {
      const user = userEvent.setup()
      searchParamsQuery = 'proposal=proposal-ai-1'

      renderWithQuery(<ReviewInboxPage />)
      await screen.findByRole('heading', { name: 'Valid checkout completes order' })

      await user.click(screen.getByText('Invalid login shows error message'))
      expect(screen.getByRole('heading', { name: 'Invalid login shows error message' })).toBeInTheDocument()

      const searchInput = screen.getByRole('searchbox', { name: /Search by title/i })
      await user.type(searchInput, 'x')
      await user.clear(searchInput)

      expect(screen.getByRole('heading', { name: 'Invalid login shows error message' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Valid checkout completes order' })).not.toBeInTheDocument()
    })

    it('falls back to the first filtered proposal when the query param id matches no proposal', async () => {
      searchParamsQuery = 'proposal=does-not-exist'

      renderWithQuery(<ReviewInboxPage />)

      expect(
        await screen.findByRole('heading', { name: 'Checkout with empty cart blocked' }),
      ).toBeInTheDocument()
      expect(screen.queryByText('Select a proposal from the queue to inspect its structured steps, source evidence, and governance actions.')).not.toBeInTheDocument()
    })
  })

  it('renders the governance statement, queue, and inspector without a local page heading', () => {
    const { container } = renderWithQuery(<ReviewInboxPage />)

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(container.querySelector('[aria-labelledby="page-title"]')).toBeInTheDocument()

    expect(
      screen.queryByText(/Human authority required for publication/i),
    ).not.toBeInTheDocument()

    expect(screen.queryByText(/Approved & published/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Active projects/i)).not.toBeInTheDocument()

    // Queue & Inspector
    expect(screen.getByRole('searchbox', { name: /Search by title/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve & publish' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()

    // Analytics panels moved to the reports page, not rendered here.
    expect(screen.queryByRole('heading', { name: /Review distribution/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Recent review decisions/i })).not.toBeInTheDocument()
  })

  it('shows a count inline on each status filter tab', () => {
    renderWithQuery(<ReviewInboxPage />)

    const inReviewTab = screen.getByRole('button', { name: /^In review/i })
    expect(inReviewTab).toBeInTheDocument()
    expect(inReviewTab.textContent).toMatch(/In review\s*\d+/)
  })

  it('allows filtering proposals by project', async () => {
    const user = userEvent.setup()
    renderWithQuery(<ReviewInboxPage />)

    const projectSelect = screen.getByRole('combobox', { name: /Project/i })
    expect(projectSelect).toBeInTheDocument()

    await user.selectOptions(projectSelect, 'proj-1')
    expect(projectSelect).toHaveValue('proj-1')

    const { listSuiteProposals } = await import('@/features/review-inbox/api/review.api')
    await screen.findByRole('button', { name: /^Approve$/i })
    expect(listSuiteProposals).toHaveBeenLastCalledWith(
      { status: 'in_review', projectId: 'proj-1' },
      expect.anything(),
    )
  })

  it('allows filtering proposals by duplicate toggle', async () => {
    const user = userEvent.setup()
    renderWithQuery(<ReviewInboxPage />)

    const duplicateButton = screen.getByRole('button', { name: /Duplicates only/i })
    expect(duplicateButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(duplicateButton)
    expect(duplicateButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(/Showing duplicates only/i)
  })

  it('allows searching proposals by text query', async () => {
    const user = userEvent.setup()
    renderWithQuery(<ReviewInboxPage />)

    const searchInput = screen.getByRole('searchbox', { name: /Search by title/i })
    await user.type(searchInput, 'nonexistentquery123xyz')

    expect(screen.getAllByText(/No review proposals found/i).length).toBeGreaterThan(0)
  })

  it('approves a proposal when clicking Approve & publish', async () => {
    const user = userEvent.setup()
    renderWithQuery(<ReviewInboxPage />)

    const approveButton = screen.getByRole('button', { name: 'Approve & publish' })
    await user.click(approveButton)

    expect(await screen.findByRole('status')).toHaveTextContent(/Empties the cart published/i)
    expect(screen.getByRole('link', { name: 'View case' })).toHaveAttribute(
      'href',
      expect.stringContaining('/suites/suite-1'),
    )
  })

  it('rejects a proposal when clicking Reject', async () => {
    const user = userEvent.setup()
    renderWithQuery(<ReviewInboxPage />)

    const rejectButton = screen.getByRole('button', { name: 'Reject' })
    await user.click(rejectButton)

    expect(await screen.findByRole('status')).toHaveTextContent(/Proposal rejected/i)
  })

  it('switches status filter between in_review, approved, rejected, and all', async () => {
    const user = userEvent.setup()
    renderWithQuery(<ReviewInboxPage />)

    const allButton = screen.getByRole('button', { name: /^All/i })
    await user.click(allButton)
    expect(allButton).toHaveAttribute('aria-pressed', 'true')

    const approvedButton = screen.getByRole('button', { name: /^Approved/i })
    await user.click(approvedButton)
    expect(approvedButton).toHaveAttribute('aria-pressed', 'true')

    const rejectedButton = screen.getByRole('button', { name: /^Rejected/i })
    await user.click(rejectedButton)
    expect(rejectedButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('approves the selected proposal with the "a" keyboard shortcut', async () => {
    const user = userEvent.setup()
    renderWithQuery(<ReviewInboxPage />)

    await user.keyboard('a')

    expect(await screen.findByRole('status')).toHaveTextContent(/Empties the cart published/i)
  })

  it('rejects the selected proposal with the "r" keyboard shortcut', async () => {
    const user = userEvent.setup()
    renderWithQuery(<ReviewInboxPage />)

    await user.keyboard('r')

    expect(await screen.findByRole('status')).toHaveTextContent(/Proposal rejected/i)
  })

  it('toggles the duplicate-only filter with the "d" keyboard shortcut', async () => {
    const user = userEvent.setup()
    renderWithQuery(<ReviewInboxPage />)

    const duplicateButton = screen.getByRole('button', { name: /Duplicates only/i })
    expect(duplicateButton).toHaveAttribute('aria-pressed', 'false')

    await user.keyboard('d')

    expect(duplicateButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders clean queue items without checkboxes', () => {
    renderWithQuery(<ReviewInboxPage />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('links the applied suite-proposal toast to the projectId the decision response carries', async () => {
    const user = userEvent.setup()
    renderWithQuery(<ReviewInboxPage />)

    const approveButton = await screen.findByRole('button', { name: /^Approve$/i })
    await user.click(approveButton)

    const statuses = await screen.findAllByRole('status')
    const toast = statuses.find((el) => /Cart suite/i.test(el.textContent ?? ''))
    expect(toast).toBeDefined()
    expect(toast?.querySelector('a')).toHaveAttribute('href', '/projects/proj-1/suites/suite-9')
  })
})

