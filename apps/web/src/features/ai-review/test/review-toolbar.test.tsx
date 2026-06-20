import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ReviewToolbar } from '@/features/ai-review/components/review-toolbar'

describe('ReviewToolbar', () => {
  it('renders three buttons', async () => {
    const props = { disabled: false, onConfirm: vi.fn(), onReject: vi.fn(), onSkip: vi.fn() }
    await act(async () => {
      render(<ReviewToolbar {...props} />)
    })
    expect(screen.getByRole('button', { name: 'Confirm case' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject case' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip case' })).toBeInTheDocument()
  })

  it('calls onConfirm when Confirm is clicked', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<ReviewToolbar disabled={false} onConfirm={onConfirm} onReject={vi.fn()} onSkip={vi.fn()} />)
    })
    await user.click(screen.getByRole('button', { name: 'Confirm case' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onReject when Reject is clicked', async () => {
    const onReject = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<ReviewToolbar disabled={false} onConfirm={vi.fn()} onReject={onReject} onSkip={vi.fn()} />)
    })
    await user.click(screen.getByRole('button', { name: 'Reject case' }))
    expect(onReject).toHaveBeenCalledTimes(1)
  })

  it('calls onSkip when Skip is clicked', async () => {
    const onSkip = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<ReviewToolbar disabled={false} onConfirm={vi.fn()} onReject={vi.fn()} onSkip={onSkip} />)
    })
    await user.click(screen.getByRole('button', { name: 'Skip case' }))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('disables buttons when disabled is true', async () => {
    await act(async () => {
      render(<ReviewToolbar disabled onConfirm={vi.fn()} onReject={vi.fn()} onSkip={vi.fn()} />)
    })
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })
})
