import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Gauge } from '../gauge'

describe('Gauge', () => {
  it('is a meter with an accessible name and value bounds when a value is present', () => {
    render(
      <Gauge value={92} label="Cases passing, 92 percent">
        <span>92%</span>
      </Gauge>,
    )

    const meter = screen.getByRole('meter', { name: 'Cases passing, 92 percent' })
    expect(meter).toHaveAttribute('aria-valuenow', '92')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '100')
    expect(meter).toHaveAttribute('aria-valuetext', 'Cases passing, 92 percent')
  })

  it('stays an image with an accessible name when there is no value', () => {
    render(
      <Gauge value={null} label="Cases passing, no data">
        <span>—</span>
      </Gauge>,
    )

    expect(screen.getByRole('img', { name: 'Cases passing, no data' })).toBeInTheDocument()
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  })

  it('renders caller-supplied centre content as children', () => {
    render(
      <Gauge value={92} label="Cases passing">
        <span>92%</span>
        <span>184/200 passed</span>
      </Gauge>,
    )

    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('184/200 passed')).toBeInTheDocument()
  })

  it('renders a full track and no ink arc when the value is null', () => {
    const { container } = render(
      <Gauge value={null} label="Cases passing, no data">
        <span>—</span>
      </Gauge>,
    )

    const sectors = container.querySelectorAll('.recharts-pie .recharts-sector')
    expect(sectors.length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.recharts-pie')).toHaveLength(1)
  })

  it('renders track and value arcs as two pies when a value is present', () => {
    const { container } = render(
      <Gauge value={50} label="Cases passing, 50 percent">
        <span>50%</span>
      </Gauge>,
    )

    expect(container.querySelectorAll('.recharts-pie')).toHaveLength(2)
  })

  it('is not part of keyboard/accessibility-layer chart navigation', () => {
    const { container } = render(
      <Gauge value={80} label="Cases passing">
        <span>80%</span>
      </Gauge>,
    )

    expect(container.querySelector('.recharts-wrapper')).not.toHaveAttribute('tabIndex')
  })
})
