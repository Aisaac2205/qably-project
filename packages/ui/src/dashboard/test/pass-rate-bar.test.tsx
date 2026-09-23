import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PassRateBar } from '../pass-rate-bar'

describe('PassRateBar', () => {
  it('fills the track proportionally to the value', () => {
    const { container } = render(<PassRateBar value={72} label="Pass rate 72 percent" />)

    const fill = container.querySelector('[data-slot="pass-rate-bar-fill"]')
    expect(fill).toHaveStyle({ width: '72%' })
  })

  it('uses the ink tone at or above the warn threshold, never the pass/green semantic tone', () => {
    const { container } = render(<PassRateBar value={92} label="Pass rate 92 percent" />)

    const fill = container.querySelector('[data-slot="pass-rate-bar-fill"]')
    expect(fill).toHaveClass('bg-qb-fg')
    expect(fill).not.toHaveClass('bg-qb-pass')
  })

  it('uses the warn tone below the warn threshold', () => {
    const { container } = render(<PassRateBar value={85} label="Pass rate 85 percent" />)

    const fill = container.querySelector('[data-slot="pass-rate-bar-fill"]')
    expect(fill).toHaveClass('bg-qb-warn')
  })

  it('respects a custom warn threshold', () => {
    const { container } = render(<PassRateBar value={85} label="Pass rate 85 percent" warnBelow={80} />)

    const fill = container.querySelector('[data-slot="pass-rate-bar-fill"]')
    expect(fill).toHaveClass('bg-qb-fg')
  })

  it('accepts a caller-supplied color override for the fill', () => {
    const { container } = render(
      <PassRateBar value={60} label="Pass rate 60 percent" color="var(--qb-chart-line)" />,
    )

    const fill = container.querySelector('[data-slot="pass-rate-bar-fill"]')
    expect(fill).toHaveStyle({ backgroundColor: 'var(--qb-chart-line)' })
  })

  it('renders an empty track and an accessible not-available name when the value is null', () => {
    render(<PassRateBar value={null} label="Pass rate" emptyLabel="No data" />)

    expect(screen.getByRole('img', { name: 'No data' })).toBeInTheDocument()
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  })

  it('exposes itself as a meter with value bounds when a value is present', () => {
    render(<PassRateBar value={72} label="Pass rate 72 percent" />)

    const meter = screen.getByRole('meter', { name: 'Pass rate 72 percent' })
    expect(meter).toHaveAttribute('aria-valuenow', '72')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '100')
    expect(meter).toHaveAttribute('aria-valuetext', 'Pass rate 72 percent')
  })
})
