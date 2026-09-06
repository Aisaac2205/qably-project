import { screen, act, within, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AiReviewPage } from '@/features/ai-review/components/ai-review-page'
import { __resetStore } from '@/lib/mock-store'
import { useI18nStore } from '@/lib/i18n'
import { renderWithQuery } from '@/lib/query-test-utils'
import * as reviewApi from '@/features/review-inbox/api/review.api'
import { proposalListFixturesFor } from '@/test/review-api-stub'
import type { ProposalFilters } from '@/features/review-inbox/api/review.api'
import { ApiError } from '@/lib/api-client'

vi.mock('@/features/review-inbox/api/review.api', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/review-inbox/api/review.api')
  >('@/features/review-inbox/api/review.api')

  return {
    ...actual,
    listProposals: vi
      .fn()
      .mockImplementation((filters: ProposalFilters) =>
        Promise.resolve(proposalListFixturesFor(filters)),
      ),
    approveProposal: vi.fn().mockResolvedValue({
      createdNewCase: true,
      testCaseId: 'case-1',
      versionId: 'version-1',
      version: 1,
      decisionId: 'decision-1',
    }),
    rejectProposal: vi.fn().mockResolvedValue({ decisionId: 'decision-1' }),
  }
})

vi.mock('@/features/ai-review/api/chat.api', () => ({
  listThreads: vi.fn().mockResolvedValue([]),
  createThread: vi.fn(),
  getThread: vi.fn(),
  sendMessage: vi.fn(),
  sendToReview: vi.fn(),
}))

function renderIsolated(projectId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>
      <AiReviewPage projectId={projectId} />
    </QueryClientProvider>,
  )
}

describe('AiReviewPage', () => {
  beforeEach(() => {
    __resetStore()
    useI18nStore.setState({ locale: 'en' })
    vi.mocked(reviewApi.listProposals).mockImplementation((filters: ProposalFilters) =>
      Promise.resolve(proposalListFixturesFor(filters)),
    )
  })

  it('renders the Review Queue tab by default with pending cases', async () => {
    await act(async () => {
      renderWithQuery(<AiReviewPage projectId="proj-1" />)
    })
    expect(screen.getByRole('tab', { name: 'Review Queue' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByText('Checkout with empty cart blocked').length).toBeGreaterThan(0)
  })

  it('shows a loading state while the queue is being fetched', async () => {
    const spy = vi.spyOn(reviewApi, 'listProposals').mockReturnValue(new Promise(() => {}))
    renderIsolated('proj-1')

    expect(await screen.findByText('Loading the review queue…')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('shows an error state when the queue fails to load', async () => {
    const spy = vi.spyOn(reviewApi, 'listProposals').mockRejectedValue(new Error('network down'))
    renderIsolated('proj-1')

    expect(await screen.findByText("Couldn't load the review queue.")).toBeInTheDocument()
    spy.mockRestore()
  })

  it('shows the empty state when there are no pending cases', async () => {
    const spy = vi.spyOn(reviewApi, 'listProposals').mockResolvedValue([])
    renderIsolated('proj-1')

    expect(await screen.findByText('No AI cases pending review')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('switches to the Project Chat tab', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<AiReviewPage projectId="proj-1" />)
    })
    await user.click(screen.getByRole('tab', { name: 'Project Chat' }))
    expect(screen.getByText('What suites have the most pending cases?')).toBeInTheDocument()
  })

  it('keeps the chat draft text when switching away from and back to the Project Chat tab', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<AiReviewPage projectId="proj-1" />)
    })

    await user.click(screen.getByRole('tab', { name: 'Project Chat' }))
    const textarea = screen.getByRole('textbox', { name: 'Message' })
    await user.type(textarea, 'Draft text')

    await user.click(screen.getByRole('tab', { name: 'Review Queue' }))
    const chatPanel = document.getElementById('ai-review-panel-chat')
    expect(chatPanel).toHaveAttribute('hidden')
    expect(document.getElementById('ai-review-panel-review')).not.toHaveAttribute('hidden')

    await user.click(screen.getByRole('tab', { name: 'Project Chat' }))
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Draft text')
  })

  it('does not expose the prohibited mass-confirm action', async () => {
    await act(async () => {
      renderWithQuery(<AiReviewPage projectId="proj-1" />)
    })
    expect(within(screen.getByRole('list', { name: 'AI review cases' })).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /confirm all/i })).not.toBeInTheDocument()
  })

  it('activates review filters by keyboard and exposes their pressed state', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AiReviewPage projectId="proj-1" />)
    const all = screen.getByRole('button', { name: 'All' })
    const duplicates = screen.getByRole('button', { name: 'Possible duplicates' })

    expect(all).toHaveAttribute('aria-pressed', 'true')
    duplicates.focus()
    await user.keyboard('{Enter}')

    expect(duplicates).toHaveFocus()
    expect(duplicates).toHaveAttribute('aria-pressed', 'true')
    expect(all).toHaveAttribute('aria-pressed', 'false')
  })

  it('approves the selected proposal and moves the selection to the next pending case', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AiReviewPage projectId="proj-1" />)

    const approveButton = screen.getByRole('button', { name: 'Approve & publish case' })
    await user.click(approveButton)

    await waitFor(() => expect(reviewApi.approveProposal).toHaveBeenCalled())
  })

  it('rejects the selected proposal', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AiReviewPage projectId="proj-1" />)

    const rejectButton = screen.getByRole('button', { name: 'Reject case' })
    await user.click(rejectButton)

    await waitFor(() => expect(reviewApi.rejectProposal).toHaveBeenCalled())
  })

  it('shows an already-decided alert on a 409 and does not clear the selection', async () => {
    vi.mocked(reviewApi.approveProposal).mockRejectedValueOnce(
      new ApiError(409, 'Conflict', 'invalid-transition'),
    )
    const user = userEvent.setup()
    renderWithQuery(<AiReviewPage projectId="proj-1" />)

    const approveButton = screen.getByRole('button', { name: 'Approve & publish case' })
    await user.click(approveButton)

    expect(await screen.findByRole('alert')).toHaveTextContent(/already decided/i)
  })
})
