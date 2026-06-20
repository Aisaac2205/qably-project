import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NewRunForm } from '@/features/runs/components/new-run-form'
import { __resetStore, createRun } from '@/lib/mock-store'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('NewRunForm', () => {
  beforeEach(() => {
    __resetStore()
    vi.clearAllMocks()
  })

  it('renders suite select', async () => {
    await act(async () => {
      render(<NewRunForm projectId="proj-1" />)
    })
    // Uses Select component; the trigger should render
    expect(screen.getByText('Select a suite')).toBeInTheDocument()
  })

  it('renders optional name input', async () => {
    await act(async () => {
      render(<NewRunForm projectId="proj-1" />)
    })
    const input = screen.getByPlaceholderText('e.g. Smoke Test')
    expect(input).toBeInTheDocument()
  })

  it('renders submit button', async () => {
    await act(async () => {
      render(<NewRunForm projectId="proj-1" />)
    })
    expect(screen.getByRole('button', { name: 'Start run' })).toBeInTheDocument()
  })

  it('shows error when submitting without suite', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<NewRunForm projectId="proj-1" />)
    })
    await user.click(screen.getByRole('button', { name: 'Start run' }))
    expect(screen.getByText('Please select a suite')).toBeInTheDocument()
  })

  it('shows empty state when no suites', async () => {
    await act(async () => {
      render(<NewRunForm projectId="proj-4" />)
    })
    // proj-4 has 0 suites in mock data
    expect(screen.getByText(/No suites available/)).toBeInTheDocument()
  })

  it('shows heading', async () => {
    await act(async () => {
      render(<NewRunForm projectId="proj-1" />)
    })
    expect(screen.getByText('New run')).toBeInTheDocument()
  })
})
