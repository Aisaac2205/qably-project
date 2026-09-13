import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusChip } from '../status-chip'

describe('StatusChip', () => {
  it('always pairs the colour with an icon and a text label', () => {
    render(<StatusChip status="pass" label="Passed" />)

    const chip = screen.getByText('Passed').closest('span')
    expect(chip).toHaveAttribute('data-status', 'pass')
    expect(chip).toHaveAttribute('data-tone', 'pass')
    expect(chip?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('speaks only the qb token vocabulary', () => {
    render(<StatusChip status="fail" label="Failed" />)

    const chip = screen.getByText('Failed').closest('span')
    expect(chip).toHaveClass('bg-qb-fail-bg')
    expect(chip).toHaveClass('text-qb-fail')
  })

  it('spins only for a running status, and never under reduced motion', () => {
    render(<StatusChip status="running" label="Running" />)

    const icon = screen.getByText('Running').closest('span')?.querySelector('svg')
    expect(icon).toHaveClass('animate-spin')
    expect(icon).toHaveClass('motion-reduce:animate-none')
  })

  it('maps skip and never-run to the muted tone rather than inventing a colour', () => {
    render(<StatusChip status="never-run" label="Never run" />)

    expect(screen.getByText('Never run').closest('span')).toHaveAttribute('data-tone', 'muted')
  })
})
