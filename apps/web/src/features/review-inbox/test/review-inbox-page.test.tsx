import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReviewApprovalConflictCode, ReviewConflictingCase } from '@qably/types'
import { ReviewInboxPage } from '../components/review-inbox-page'
import { reviewKeys } from '../lib/query-keys'
import { __resetStore } from '@/lib/mock-store'
import { useI18nStore } from '@/lib/i18n'
import { createTestQueryClient, renderWithQuery } from '@/lib/query-test-utils'
import { ApiError } from '@/lib/api-client'
import { approveProposal, rejectProposal } from '@/features/review-inbox/api/review.api'
import { proposalInboxCountsFixtures, proposalInboxFixtures } from '@/test/review-api-stub'
import { approvalConflictError, conflictingCaseFixture } from './approval-conflict-fixture'

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

  it('renders the governance statement, queue, and inspector with a single, visually hidden page heading', () => {
    const { container } = renderWithQuery(<ReviewInboxPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Review Inbox' })).toBeInTheDocument()
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

    fireEvent.click(projectSelect)
    await user.click(screen.getByRole('option', { name: 'Ecommerce App' }))
    expect(projectSelect).toHaveTextContent('Ecommerce App')
    expect(screen.getByText('Invalid login shows error message')).toBeInTheDocument()

    fireEvent.click(projectSelect)
    await user.click(screen.getByRole('option', { name: 'Mobile App' }))
    expect(projectSelect).toHaveTextContent('Mobile App')
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

  describe('approval conflicts', () => {
    function inReviewQueue() {
      return proposalInboxFixtures({ status: 'in_review' })
    }

    function suiteEditHref(projectId: string, conflictingCase: ReviewConflictingCase) {
      return `/projects/${projectId}/suites/${conflictingCase.suiteId}/edit?case=${conflictingCase.id}`
    }

    function deferredApproval() {
      let rejectApproval!: (error: unknown) => void
      vi.mocked(approveProposal).mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectApproval = reject
          }),
      )
      return {
        fail: async (error: unknown) => {
          await act(async () => {
            rejectApproval(error)
          })
        },
      }
    }

    function renderSearchedFor(title: string) {
      searchParamsQuery = new URLSearchParams({ search: title }).toString()
      const client = createTestQueryClient()
      const filters = { status: 'in_review' as const, search: title }
      client.setQueryData(reviewKeys.inbox(filters), {
        pages: [{ items: proposalInboxFixtures(filters), nextCursor: null }],
        pageParams: [null],
      })
      client.setQueryData(reviewKeys.inboxCounts({ search: title }), {
        byStatus: proposalInboxCountsFixtures({ search: title }),
        openCollisions: 0,
        version: 'test-version',
      })
      return render(
        <QueryClientProvider client={client}>
          <ReviewInboxPage />
        </QueryClientProvider>,
      )
    }

    async function approveOnlyProposalFailingWith(
      code: ReviewApprovalConflictCode,
      conflictingCase: ReviewConflictingCase | null,
      approveLabel = 'Approve & publish',
    ) {
      const [failing] = inReviewQueue()
      vi.mocked(approveProposal).mockRejectedValueOnce(
        await approvalConflictError(code, conflictingCase),
      )
      const user = userEvent.setup()
      renderSearchedFor(failing.title)
      await screen.findByRole('heading', { name: failing.title })

      await user.click(screen.getByRole('button', { name: approveLabel }))

      return { user, failing, alert: await screen.findByRole('alert') }
    }

    it('names the failed proposal and links to the case that already uses its title', async () => {
      const { failing, alert } = await approveOnlyProposalFailingWith(
        'name-taken',
        conflictingCaseFixture,
      )

      expect(alert).toHaveTextContent(`Couldn't publish “${failing.title}”`)
      expect(alert).toHaveTextContent(/an official case with the same title already exists/i)
      expect(alert).toHaveTextContent(/reject the proposal, or rename or remove that case/i)
      expect(within(alert).getByRole('link', { name: 'View existing case' })).toHaveAttribute(
        'href',
        suiteEditHref(failing.projectId, conflictingCaseFixture),
      )
    })

    it('still explains a title collision when the API could not name the case', async () => {
      const { failing, alert } = await approveOnlyProposalFailingWith('name-taken', null)

      expect(alert).toHaveTextContent(failing.title)
      expect(alert).toHaveTextContent(/an official case with the same title already exists/i)
      expect(within(alert).queryByRole('link')).not.toBeInTheDocument()
    })

    it('explains an automation key collision with the case name and promises nothing it cannot keep', async () => {
      const { failing, alert } = await approveOnlyProposalFailingWith(
        'automation-key-taken',
        conflictingCaseFixture,
      )

      expect(alert).toHaveTextContent(failing.title)
      expect(alert).toHaveTextContent(
        /the official case .Empties the cart. already has the same automation key/i,
      )
      expect(alert).toHaveTextContent(/open that case to compare them, or reject the proposal/i)
      expect(alert).not.toHaveTextContent(/re-check|reload/i)
      expect(within(alert).getByRole('link', { name: 'View existing case' })).toHaveAttribute(
        'href',
        suiteEditHref(failing.projectId, conflictingCaseFixture),
      )
    })

    it('explains an automation key collision without a case name when none is available', async () => {
      const { alert } = await approveOnlyProposalFailingWith('automation-key-taken', null)

      expect(alert).toHaveTextContent(
        /an official case with the same automation key already exists in this suite/i,
      )
      expect(within(alert).queryByRole('link')).not.toBeInTheDocument()
    })

    it('reports a publish conflict without promising that approving again will work, and without a link', async () => {
      const { failing, alert } = await approveOnlyProposalFailingWith('publish-conflict', null)

      expect(alert).toHaveTextContent(failing.title)
      expect(alert).toHaveTextContent(/because of a conflict with the official cases/i)
      expect(alert).toHaveTextContent(/try again later, or reject the proposal/i)
      expect(alert).not.toHaveTextContent(/approve (it )?again/i)
      expect(within(alert).queryByRole('link')).not.toBeInTheDocument()
    })

    it('reports a publish conflict in Spanish without promising success', async () => {
      useI18nStore.setState({ locale: 'es' })

      const { failing, alert } = await approveOnlyProposalFailingWith(
        'publish-conflict',
        null,
        'Aprobar y publicar',
      )

      expect(alert).toHaveTextContent(`No se pudo publicar “${failing.title}”`)
      expect(alert).toHaveTextContent(/por un conflicto con los casos oficiales/i)
      expect(alert).toHaveTextContent(/inténtalo más tarde o rechaza la propuesta/i)
      expect(alert).not.toHaveTextContent(/vuelve a aprobarla/i)
    })

    it('never shows an error code or an id as prose', async () => {
      const { alert } = await approveOnlyProposalFailingWith(
        'automation-key-taken',
        conflictingCaseFixture,
      )

      expect(alert.textContent).not.toMatch(/automation-key-taken|name-taken|publish-conflict/)
      expect(alert.textContent).not.toContain(conflictingCaseFixture.id)
      expect(alert.textContent).not.toContain(conflictingCaseFixture.suiteId)
    })

    it.each([
      ['name-taken', conflictingCaseFixture],
      ['automation-key-taken', conflictingCaseFixture],
      ['publish-conflict', null],
    ] as const)(
      'with nothing else to review, keeps the failed proposal in the inspector with both decisions enabled after %s',
      async (code, conflictingCase) => {
        const { failing } = await approveOnlyProposalFailingWith(code, conflictingCase)

        expect(
          await screen.findByRole('heading', { name: failing.title }),
        ).toBeInTheDocument()
        await waitFor(() =>
          expect(screen.getByRole('button', { name: 'Approve & publish' })).toBeEnabled(),
        )
        expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled()
      },
    )

    it('keeps the failed proposal in the queue after the conflict', async () => {
      const { failing } = await approveOnlyProposalFailingWith('name-taken', conflictingCaseFixture)

      const queue = screen.getByRole('region', { name: 'Proposals queue' })
      expect(within(queue).getByText(failing.title)).toBeInTheDocument()
    })

    it('lets the reviewer reject the failed proposal and clears its error', async () => {
      vi.mocked(rejectProposal).mockClear()
      const { user, failing } = await approveOnlyProposalFailingWith(
        'name-taken',
        conflictingCaseFixture,
      )

      await waitFor(() => expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled())
      await user.click(screen.getByRole('button', { name: 'Reject' }))

      expect(await screen.findByRole('status')).toHaveTextContent(/Proposal rejected/i)
      expect(vi.mocked(rejectProposal)).toHaveBeenCalledWith(failing.id, undefined)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('lets the reviewer approve the failed proposal again after a publish conflict', async () => {
      const { user } = await approveOnlyProposalFailingWith('publish-conflict', null)

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Approve & publish' })).toBeEnabled(),
      )
      await user.click(screen.getByRole('button', { name: 'Approve & publish' }))

      expect(await screen.findByRole('status')).toHaveTextContent(/Empties the cart published/i)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('announces an identical failure of a retry as a fresh alert', async () => {
      vi.mocked(approveProposal).mockRejectedValueOnce(
        await approvalConflictError('publish-conflict', null),
      )
      const { user, alert: firstAlert } = await approveOnlyProposalFailingWith(
        'publish-conflict',
        null,
      )

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Approve & publish' })).toBeEnabled(),
      )
      await user.click(screen.getByRole('button', { name: 'Approve & publish' }))

      await waitFor(() => expect(screen.getByRole('alert')).not.toBe(firstAlert))
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(screen.getByRole('alert')).toHaveTextContent(firstAlert.textContent ?? '')
    })

    it('announces the conflict in Spanish with the same link', async () => {
      useI18nStore.setState({ locale: 'es' })

      const { failing, alert } = await approveOnlyProposalFailingWith(
        'automation-key-taken',
        conflictingCaseFixture,
        'Aprobar y publicar',
      )

      expect(alert).toHaveTextContent(`No se pudo publicar “${failing.title}”`)
      expect(alert).toHaveTextContent(/el caso oficial “Empties the cart” ya tiene la misma clave/)
      expect(within(alert).getByRole('link', { name: 'Ver caso existente' })).toHaveAttribute(
        'href',
        suiteEditHref(failing.projectId, conflictingCaseFixture),
      )
    })

    it('collapses repeated identical failures into one alert with a count that the reviewer can dismiss', async () => {
      const [first, second, third] = inReviewQueue()
      const outage = () => new ApiError(500, 'Server Error', 'internal-error')
      const firstApproval = deferredApproval()
      const secondApproval = deferredApproval()
      const thirdApproval = deferredApproval()
      const user = userEvent.setup()
      renderWithQuery(<ReviewInboxPage />)
      await screen.findByRole('heading', { name: first.title })

      await user.keyboard('a')
      await screen.findByRole('heading', { name: second.title })
      await user.keyboard('a')
      await screen.findByRole('heading', { name: third.title })
      await user.keyboard('a')

      await firstApproval.fail(outage())
      await secondApproval.fail(outage())
      await thirdApproval.fail(outage())

      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('Happened 3 times'),
      )
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(screen.getByRole('alert')).toHaveTextContent(/couldn't process this decision/i)

      await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Dismiss' }))

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('never touches the history when the failure arrives after the page unmounted', async () => {
      const [failing] = inReviewQueue()
      const conflict = await approvalConflictError('name-taken', conflictingCaseFixture)
      const approval = deferredApproval()
      const user = userEvent.setup()
      const { unmount } = renderSearchedFor(failing.title)
      await screen.findByRole('heading', { name: failing.title })
      await user.click(screen.getByRole('button', { name: 'Approve & publish' }))
      await waitFor(() =>
        expect(screen.queryByRole('heading', { name: failing.title })).not.toBeInTheDocument(),
      )
      unmount()
      const pushSpy = vi.spyOn(window.history, 'pushState')
      const replaceSpy = vi.spyOn(window.history, 'replaceState')

      await approval.fail(conflict)

      expect(pushSpy).not.toHaveBeenCalled()
      expect(replaceSpy).not.toHaveBeenCalled()
      pushSpy.mockRestore()
      replaceSpy.mockRestore()
    })

    describe('while the reviewer keeps deciding with the keyboard', () => {
      it('never moves the selection for a late failure, so the next r rejects the live proposal', async () => {
        const [first, second, third] = inReviewQueue()
        const conflict = await approvalConflictError('name-taken', conflictingCaseFixture)
        const firstApproval = deferredApproval()
        vi.mocked(rejectProposal).mockClear()
        const user = userEvent.setup()
        renderWithQuery(<ReviewInboxPage />)
        await screen.findByRole('heading', { name: first.title })

        await user.keyboard('a')
        await screen.findByRole('heading', { name: second.title })
        await user.keyboard('a')
        await screen.findByRole('heading', { name: third.title })

        await firstApproval.fail(conflict)

        expect(await screen.findByRole('alert')).toHaveTextContent(first.title)
        expect(screen.getByRole('heading', { name: third.title })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: first.title })).not.toBeInTheDocument()

        await user.keyboard('r')

        await waitFor(() => expect(vi.mocked(rejectProposal)).toHaveBeenCalledTimes(1))
        expect(vi.mocked(rejectProposal)).toHaveBeenCalledWith(third.id, undefined)
      })

      it('surfaces two failures that arrive out of order, each naming its proposal', async () => {
        const [first, second, third] = inReviewQueue()
        const firstConflict = await approvalConflictError('name-taken', conflictingCaseFixture)
        const secondConflict = await approvalConflictError('publish-conflict', null)
        const firstApproval = deferredApproval()
        const secondApproval = deferredApproval()
        const user = userEvent.setup()
        renderWithQuery(<ReviewInboxPage />)
        await screen.findByRole('heading', { name: first.title })

        await user.keyboard('a')
        await screen.findByRole('heading', { name: second.title })
        await user.keyboard('a')
        await screen.findByRole('heading', { name: third.title })

        await secondApproval.fail(secondConflict)
        await firstApproval.fail(firstConflict)

        await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
        const [earlierAlert, laterAlert] = screen.getAllByRole('alert')
        expect(earlierAlert).toHaveTextContent(second.title)
        expect(earlierAlert).toHaveTextContent(/because of a conflict with the official cases/i)
        expect(laterAlert).toHaveTextContent(first.title)
        expect(laterAlert).toHaveTextContent(/same title already exists/i)
        expect(screen.getByRole('heading', { name: third.title })).toBeInTheDocument()
      })

      it('links to the conflicting case even after the failed proposal left the list', async () => {
        const [first, second] = inReviewQueue()
        const conflict = await approvalConflictError('automation-key-taken', conflictingCaseFixture)
        const approval = deferredApproval()
        const user = userEvent.setup()
        renderWithQuery(<ReviewInboxPage />)
        await screen.findByRole('heading', { name: first.title })

        await user.keyboard('a')
        await screen.findByRole('heading', { name: second.title })
        const queue = screen.getByRole('region', { name: 'Proposals queue' })
        await waitFor(() => expect(within(queue).queryByText(first.title)).not.toBeInTheDocument())

        await approval.fail(conflict)

        const alert = await screen.findByRole('alert')
        expect(within(alert).getByRole('link', { name: 'View existing case' })).toHaveAttribute(
          'href',
          suiteEditHref(first.projectId, conflictingCaseFixture),
        )
      })

      it('keeps the success of a later decision and the failure of an earlier one side by side', async () => {
        const [first, second] = inReviewQueue()
        const conflict = await approvalConflictError('publish-conflict', null)
        const firstApproval = deferredApproval()
        const user = userEvent.setup()
        renderWithQuery(<ReviewInboxPage />)
        await screen.findByRole('heading', { name: first.title })

        await user.keyboard('a')
        await screen.findByRole('heading', { name: second.title })
        await firstApproval.fail(conflict)
        expect(await screen.findByRole('alert')).toHaveTextContent(first.title)

        await user.keyboard('a')

        const success = await screen.findByText(/Empties the cart published/i)
        expect(success.closest('[role="status"]')).not.toBeNull()
        expect(screen.getByRole('alert')).toHaveTextContent(first.title)
      })
    })
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

    it('renders the back control as the shared chevron button named for the queue', async () => {
      const user = userEvent.setup()
      renderWithQuery(<ReviewInboxPage />)

      await user.click(screen.getByText('Checkout with empty cart blocked'))

      const back = screen.getByRole('button', { name: 'Back to queue' })
      expect(back.textContent).toBe('')
      expect(back).toHaveAttribute('title', 'Back to queue')
      expect(back).toHaveClass('size-11', 'md:size-8')
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

    it('never reopens the detail when an approval fails after the reviewer went back to the list, and only shows the error', async () => {
      const [first, second] = proposalInboxFixtures({ status: 'in_review' })
      const conflict = await approvalConflictError('name-taken', conflictingCaseFixture)
      let failFirstApproval!: (error: unknown) => void
      vi.mocked(approveProposal)
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              failFirstApproval = reject
            }),
        )
        .mockImplementationOnce(() => new Promise(() => {}))
      const user = userEvent.setup()
      renderWithQuery(<ReviewInboxPage />)

      await user.click(screen.getByText(first.title))
      await user.click(screen.getByRole('button', { name: 'Approve & publish' }))
      await screen.findByRole('heading', { name: second.title })
      await user.click(screen.getByRole('button', { name: 'Approve & publish' }))
      await user.click(screen.getByRole('button', { name: 'Back to queue' }))
      await waitFor(() =>
        expect(screen.getByRole('region', { name: 'Proposals queue' }).className).not.toMatch(
          /\bhidden\b/,
        ),
      )

      const pushSpy = vi.spyOn(window.history, 'pushState')
      const replaceSpy = vi.spyOn(window.history, 'replaceState')
      await act(async () => {
        failFirstApproval(conflict)
      })

      expect(await screen.findByRole('alert')).toHaveTextContent(first.title)
      const queueRegion = screen.getByRole('region', { name: 'Proposals queue' })
      const detailRegion = screen.getByRole('region', { name: 'Proposal details' })
      expect(queueRegion.className).not.toMatch(/\bhidden\b/)
      expect(detailRegion.className).toMatch(/\bhidden\b/)
      expect(screen.queryByRole('heading', { name: first.title })).not.toBeInTheDocument()
      expect(detailRegion.contains(document.activeElement)).toBe(false)
      expect(pushSpy).not.toHaveBeenCalled()
      expect(replaceSpy).not.toHaveBeenCalledWith(null, '', expect.stringContaining('proposal='))
      expect(`${window.location.pathname}${window.location.search}`).toBe('/review-inbox')
      pushSpy.mockRestore()
      replaceSpy.mockRestore()
    })
  })
})

