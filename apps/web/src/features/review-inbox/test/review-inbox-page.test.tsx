import { screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ReviewInboxPage } from '../components/review-inbox-page'
import { __resetStore } from '@/lib/mock-store'
import { useI18nStore } from '@/lib/i18n'
import { renderWithQuery } from '@/lib/query-test-utils'
import { ApiError } from '@/lib/api-client'
import { approveProposal } from '@/features/review-inbox/api/review.api'

let searchParamsQuery = ''
let isMobileViewport = false

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return isMobileViewport
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

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
  }
})

describe('ReviewInboxPage', () => {
  beforeEach(() => {
    __resetStore()
    useI18nStore.setState({ locale: 'en' })
    searchParamsQuery = ''
    isMobileViewport = false
    window.history.replaceState(null, '', '/review-inbox')
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
    expect(screen.getByText('Invalid login shows error message')).toBeInTheDocument()

    await user.selectOptions(projectSelect, 'proj-2')
    expect(projectSelect).toHaveValue('proj-2')
    expect(screen.queryByText('Invalid login shows error message')).not.toBeInTheDocument()
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

    await waitFor(() =>
      expect(screen.getAllByText(/No review proposals found/i).length).toBeGreaterThan(0),
    )
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

  it('calls approve only once when the button is clicked twice before the request resolves', async () => {
    let resolveApproval!: (value: Awaited<ReturnType<typeof approveProposal>>) => void
    vi.mocked(approveProposal).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveApproval = resolve
        }),
    )
    vi.mocked(approveProposal).mockClear()
    renderWithQuery(<ReviewInboxPage />)

    const approveButton = screen.getByRole('button', { name: 'Approve & publish' })
    await act(async () => {
      fireEvent.click(approveButton)
      fireEvent.click(approveButton)
    })

    resolveApproval({
      createdNewCase: true,
      testCaseId: 'case-1',
      testCaseName: 'Empties the cart',
      suiteId: 'suite-1',
      versionId: 'version-1',
      version: 1,
      decisionId: 'decision-1',
    })

    await waitFor(() => expect(vi.mocked(approveProposal)).toHaveBeenCalledTimes(1))
  })

  it('shows who decided and when on an invalid-transition conflict', async () => {
    vi.mocked(approveProposal).mockRejectedValueOnce(
      new ApiError(409, 'Conflict', 'invalid-transition', {
        decision: {
          action: 'approved',
          decidedAt: new Date().toISOString(),
          decidedBy: { id: 'user-2', name: 'Grace Hopper' },
        },
      }),
    )
    const user = userEvent.setup()
    renderWithQuery(<ReviewInboxPage />)

    const approveButton = screen.getByRole('button', { name: 'Approve & publish' })
    await user.click(approveButton)

    expect(await screen.findByRole('alert')).toHaveTextContent(/Grace Hopper already approved/i)
  })

  it('shows a clear error toast instead of doing nothing when approve fails because the proposal has no steps', async () => {
    vi.mocked(approveProposal).mockRejectedValueOnce(
      new ApiError(422, 'Unprocessable', 'incomplete-proposal'),
    )
    const user = userEvent.setup()
    renderWithQuery(<ReviewInboxPage />)

    const approveButton = screen.getByRole('button', { name: 'Approve & publish' })
    await user.click(approveButton)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /this proposal has no steps/i,
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

  describe('mobile responsive behavior', () => {
    beforeEach(() => {
      isMobileViewport = true
    })

    it('shows only the queue, never the detail pane, when nothing is deep-linked', () => {
      renderWithQuery(<ReviewInboxPage />)

      const queueRegion = screen.getByRole('region', { name: 'Proposals queue' })
      const detailRegion = screen.getByRole('region', { name: 'Proposal details' })
      expect(queueRegion.className).not.toMatch(/\bhidden\b/)
      expect(detailRegion.className).toMatch(/\bhidden\b/)
    })

    it('opens the detail pane and hides the queue when a proposal row is tapped', async () => {
      const user = userEvent.setup()
      renderWithQuery(<ReviewInboxPage />)

      await user.click(screen.getByText('Checkout with empty cart blocked'))

      const queueRegion = screen.getByRole('region', { name: 'Proposals queue' })
      const detailRegion = screen.getByRole('region', { name: 'Proposal details' })
      expect(detailRegion.className).not.toMatch(/\bhidden\b/)
      expect(queueRegion.className).toMatch(/\bhidden\b/)
      expect(
        screen.getByRole('heading', { name: 'Checkout with empty cart blocked' }),
      ).toBeInTheDocument()
      expect(screen.getByText(/of \d+ proposals?/i)).toBeInTheDocument()
    })

    it('restores the queue when the back button is pressed', async () => {
      const user = userEvent.setup()
      renderWithQuery(<ReviewInboxPage />)

      await user.click(screen.getByText('Checkout with empty cart blocked'))
      expect(
        screen.getByRole('heading', { name: 'Checkout with empty cart blocked' }),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Back to queue' }))

      await waitFor(() => {
        const queueRegion = screen.getByRole('region', { name: 'Proposals queue' })
        expect(queueRegion.className).not.toMatch(/\bhidden\b/)
      })
      const detailRegion = screen.getByRole('region', { name: 'Proposal details' })
      expect(detailRegion.className).toMatch(/\bhidden\b/)
    })

    it('opens the deep-linked proposal directly on mobile', async () => {
      searchParamsQuery = 'proposal=proposal-ai-1'

      renderWithQuery(<ReviewInboxPage />)

      expect(
        await screen.findByRole('heading', { name: 'Valid checkout completes order' }),
      ).toBeInTheDocument()
      const queueRegion = screen.getByRole('region', { name: 'Proposals queue' })
      expect(queueRegion.className).toMatch(/\bhidden\b/)
    })

    it('advances to the next pending proposal after approving, staying in the detail pane', async () => {
      const user = userEvent.setup()
      renderWithQuery(<ReviewInboxPage />)

      await user.click(screen.getByText('Checkout with empty cart blocked'))
      const approveButton = screen.getByRole('button', { name: 'Approve & publish' })
      await user.click(approveButton)

      await waitFor(() => {
        const detailRegion = screen.getByRole('region', { name: 'Proposal details' })
        expect(detailRegion.className).not.toMatch(/\bhidden\b/)
      })
    })

    it('moves focus to the detail heading when a proposal row is tapped', async () => {
      const user = userEvent.setup()
      renderWithQuery(<ReviewInboxPage />)

      await user.click(screen.getByText('Checkout with empty cart blocked'))

      const heading = screen.getByRole('heading', { name: 'Checkout with empty cart blocked' })
      expect(document.activeElement).toBe(heading)
      expect(heading).toHaveAttribute('tabIndex', '-1')
    })

    it('returns focus to the originating queue row when the back button closes the detail', async () => {
      const user = userEvent.setup()
      renderWithQuery(<ReviewInboxPage />)

      const row = screen.getByText('Checkout with empty cart blocked').closest('button')
      expect(row).not.toBeNull()
      await user.click(row as HTMLButtonElement)
      await user.click(screen.getByRole('button', { name: 'Back to queue' }))

      await waitFor(() => expect(document.activeElement).toBe(row))
    })

    it('falls back to focusing the queue container when the originating row is gone (e.g. after a decision)', async () => {
      const user = userEvent.setup()
      renderWithQuery(<ReviewInboxPage />)

      await user.click(screen.getByText('Checkout with empty cart blocked'))
      await user.click(screen.getByRole('button', { name: 'Approve & publish' }))
      await waitFor(() =>
        expect(screen.queryByText('Checkout with empty cart blocked')).not.toBeInTheDocument(),
      )

      await user.click(screen.getByRole('button', { name: 'Back to queue' }))

      await waitFor(() => {
        const queueRegion = screen.getByRole('region', { name: 'Proposals queue' })
        expect(document.activeElement).toBe(queueRegion)
      })
    })
  })
})

