import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusChip } from '@/components/ui/status-chip'

describe('StatusChip (global)', () => {
  it('renders pass status with icon and label', async () => {
    await act(async () => {
      render(<StatusChip status="pass" />)
    })
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('renders fail status with warn-bg color class', async () => {
    await act(async () => {
      render(<StatusChip status="fail" />)
    })
    const chip = screen.getByText('Fail').closest('span')
    expect(chip?.className).toContain('text-fail')
    expect(chip?.querySelector('svg')).toBeTruthy()
  })

  it('renders running with spinner icon', async () => {
    await act(async () => {
      render(<StatusChip status="running" />)
    })
    expect(screen.getByText('Running')).toBeInTheDocument()
    const chip = screen.getByText('Running').closest('span')
    expect(chip?.querySelector('svg')?.classList.contains('animate-spin')).toBe(true)
  })

  it('renders never-run with muted class and circle icon', async () => {
    await act(async () => {
      render(<StatusChip status="never-run" />)
    })
    expect(screen.getByText('Never run')).toBeInTheDocument()
    const chip = screen.getByText('Never run').closest('span')
    expect(chip?.className).toContain('text-muted')
    expect(chip?.querySelector('svg')).toBeTruthy()
  })

  it('renders needs-attention with warn color', async () => {
    await act(async () => {
      render(<StatusChip status="needs-attention" />)
    })
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    const chip = screen.getByText('Needs attention').closest('span')
    expect(chip?.className).toContain('text-warn')
  })

  it('falls back to pending for unknown status', async () => {
    // @ts-expect-error testing runtime fallback
    await act(async () => {
      render(<StatusChip status="bogus" />)
    })
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })
})
