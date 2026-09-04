import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ReviewInboxPage } from '../components/review-inbox-page'
import { __resetStore } from '@/lib/mock-store'
import { useI18nStore } from '@/lib/i18n'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/review-inbox/api/review.api', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/review-inbox/api/review.api')
  >('@/features/review-inbox/api/review.api')

  return {
    ...actual,
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

describe('ReviewInboxPage', () => {
  beforeEach(() => {
    __resetStore()
    useI18nStore.setState({ locale: 'en' })
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

    expect(await screen.findByRole('status')).toHaveTextContent(/Proposal approved and published/i)
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

    expect(await screen.findByRole('status')).toHaveTextContent(/Proposal approved and published/i)
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
})
