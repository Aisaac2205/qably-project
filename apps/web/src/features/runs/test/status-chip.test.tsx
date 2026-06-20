import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusChip } from '@/features/runs/components/status-chip'

describe('StatusChip (runs)', () => {
  it('renders pass status with icon and label', async () => {
    await act(async () => {
      render(<StatusChip status="pass" />)
    })
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('renders fail status with icon and label', async () => {
    await act(async () => {
      render(<StatusChip status="fail" />)
    })
    expect(screen.getByText('Fail')).toBeInTheDocument()
  })

  it('renders running status', async () => {
    await act(async () => {
      render(<StatusChip status="running" />)
    })
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('renders pending status', async () => {
    await act(async () => {
      render(<StatusChip status="pending" />)
    })
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('renders pass with appropriate color class', async () => {
    await act(async () => {
      render(<StatusChip status="pass" />)
    })
    const chip = screen.getByText('Pass').closest('span')
    expect(chip?.className).toContain('text-pass')
  })

  it('renders with icon present (not color-only)', async () => {
    await act(async () => {
      render(<StatusChip status="fail" />)
    })
    const chip = screen.getByText('Fail').closest('span')
    // The chip has an SVG icon inside it
    expect(chip?.querySelector('svg')).toBeTruthy()
  })
})
