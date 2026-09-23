import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Gauge } from '../gauge'

describe('Gauge', () => {
  it('is an image with an accessible name', () => {
    render(
      <Gauge value={92} label="Cases passing, 92 percent">
        <span>92%</span>
      </Gauge>,
    )

    expect(screen.getByRole('img', { name: 'Cases passing, 92 percent' })).toBeInTheDocument()
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
