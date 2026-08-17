import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach } from 'vitest'
import { ReviewInboxPage } from '../components/review-inbox-page'
import { __resetStore } from '@/lib/mock-store'
import { useI18nStore } from '@/lib/i18n'

describe('ReviewInboxPage', () => {
  beforeEach(() => {
    __resetStore()
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders page header, KPIs, governance banner, queue, inspector, and analytics', () => {
    render(<ReviewInboxPage />)

    // Header & Breadcrumb
    expect(screen.getByRole('heading', { level: 1, name: /Review Inbox/i })).toBeInTheDocument()

    // Governance Banner
    expect(screen.getByRole('heading', { level: 2, name: /Human authority required for publication/i })).toBeInTheDocument()

    // KPIs
    expect(screen.getAllByText(/Pending review/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Approved & published/i)).toBeInTheDocument()
    expect(screen.getByText(/Potential duplicates/i)).toBeInTheDocument()
    expect(screen.getByText(/Active projects/i)).toBeInTheDocument()

    // Queue & Inspector
    expect(screen.getByRole('searchbox', { name: /Search by title/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve & publish' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()

    // Secondary Analytics
    expect(screen.getByRole('heading', { level: 3, name: /Review distribution/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /Recent review decisions/i })).toBeInTheDocument()
  })

  it('allows filtering proposals by project', async () => {
    const user = userEvent.setup()
    render(<ReviewInboxPage />)

    const projectSelect = screen.getByRole('combobox', { name: /Project/i })
    expect(projectSelect).toBeInTheDocument()

    // Filter to Ecommerce App (proj-1)
    await user.selectOptions(projectSelect, 'proj-1')
    expect(projectSelect).toHaveValue('proj-1')
  })

  it('allows filtering proposals by duplicate toggle', async () => {
    const user = userEvent.setup()
    render(<ReviewInboxPage />)

    const duplicateButton = screen.getByRole('button', { name: /Duplicates only/i })
    expect(duplicateButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(duplicateButton)
    expect(duplicateButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('allows searching proposals by text query', async () => {
    const user = userEvent.setup()
    render(<ReviewInboxPage />)

    const searchInput = screen.getByRole('searchbox', { name: /Search by title/i })
    await user.type(searchInput, 'nonexistentquery123xyz')

    expect(screen.getAllByText(/No review proposals found/i).length).toBeGreaterThan(0)
  })

  it('approves a proposal when clicking Approve & publish', async () => {
    const user = userEvent.setup()
    render(<ReviewInboxPage />)

    const approveButton = screen.getByRole('button', { name: 'Approve & publish' })
    await user.click(approveButton)

    // Success toast banner appears
    expect(screen.getByRole('status')).toHaveTextContent(/Proposal approved and published/i)
  })

  it('rejects a proposal when clicking Reject', async () => {
    const user = userEvent.setup()
    render(<ReviewInboxPage />)

    const rejectButton = screen.getByRole('button', { name: 'Reject' })
    await user.click(rejectButton)

    // Feedback banner appears
    expect(screen.getByRole('status')).toHaveTextContent(/Proposal rejected/i)
  })

  it('switches status filter between in_review, approved, rejected, and all', async () => {
    const user = userEvent.setup()
    render(<ReviewInboxPage />)

    const allButton = screen.getByRole('button', { name: 'All' })
    await user.click(allButton)
    expect(allButton).toHaveAttribute('aria-pressed', 'true')

    const approvedButton = screen.getByRole('button', { name: 'Approved' })
    await user.click(approvedButton)
    expect(approvedButton).toHaveAttribute('aria-pressed', 'true')

    const rejectedButton = screen.getByRole('button', { name: 'Rejected' })
    await user.click(rejectedButton)
    expect(rejectedButton).toHaveAttribute('aria-pressed', 'true')
  })
})
