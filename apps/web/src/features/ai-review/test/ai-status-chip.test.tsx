import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AiStatusChip } from '@/features/ai-review/components/ai-status-chip'

describe('AiStatusChip', () => {
  it('renders pending with icon and label', async () => {
    await act(async () => {
      render(<AiStatusChip status="pending" />)
    })
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('renders confirmed with icon and label', async () => {
    await act(async () => {
      render(<AiStatusChip status="confirmed" />)
    })
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
  })

  it('renders rejected with icon and label', async () => {
    await act(async () => {
      render(<AiStatusChip status="rejected" />)
    })
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('renders with color class', async () => {
    await act(async () => {
      render(<AiStatusChip status="confirmed" />)
    })
    const chip = screen.getByText('Confirmed').closest('span')
    expect(chip?.className).toContain('text-pass')
  })

  it('renders icon (not color alone)', async () => {
    await act(async () => {
      render(<AiStatusChip status="pending" />)
    })
    const chip = screen.getByText('Pending').closest('span')
    expect(chip?.querySelector('svg')).toBeTruthy()
  })
})
