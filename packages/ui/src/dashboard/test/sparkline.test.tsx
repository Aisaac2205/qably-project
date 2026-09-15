import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sparkline } from '../sparkline'

function pathCommandPoints(d: string): { x: number; y: number }[] {
  return d
    .split(/(?=[MLC])/)
    .filter(Boolean)
    .map((segment) => {
      const pairs = segment
        .slice(1)
        .trim()
        .split(/\s+/)
        .map((pair) => {
          const [x, y] = pair.split(',').map(Number)
          return { x: x as number, y: y as number }
        })
      // A cubic (C) command carries two control points before the actual data point.
      return pairs[pairs.length - 1] as { x: number; y: number }
    })
}

describe('Sparkline', () => {
  it('is an image with an accessible name, never a decorative squiggle', () => {
    render(<Sparkline values={[10, 40, 30, 60]} label="Pass rate over the last 4 runs" />)

    expect(screen.getByRole('img', { name: 'Pass rate over the last 4 runs' })).toBeInTheDocument()
  })

  it('plots one point per value and marks only the last one', () => {
    const { container } = render(<Sparkline values={[10, 40, 30, 60]} label="trend" />)

    const path = container.querySelector('.recharts-line-curve')
    const points = pathCommandPoints(path?.getAttribute('d') ?? '')
    expect(points).toHaveLength(4)
    expect(container.querySelectorAll('circle')).toHaveLength(1)
  })

  it('draws a flat line rather than dividing by zero when every value is equal', () => {
    const { container } = render(<Sparkline values={[50, 50, 50]} label="flat" />)

    const path = container.querySelector('.recharts-line-curve')
    const points = pathCommandPoints(path?.getAttribute('d') ?? '')
    const ys = points.map((point) => point.y)
    expect(new Set(ys).size).toBe(1)
    expect(ys.every((y) => Number.isFinite(y))).toBe(true)
  })

  it('renders nothing for fewer than two values', () => {
    const { container } = render(<Sparkline values={[42]} label="single" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('colours both the line and the last-value marker by tone', () => {
    const { container } = render(<Sparkline values={[10, 20, 30]} label="trend" tone="fail" />)

    const marker = container.querySelector('circle')
    expect(marker).toHaveClass('fill-qb-fail')
    const line = container.querySelector('.recharts-line')
    expect(line).toHaveClass('stroke-qb-fail')
  })

  it('defaults the line tone to primary when no tone is given', () => {
    const { container } = render(<Sparkline values={[10, 20, 30]} label="trend" />)

    const line = container.querySelector('.recharts-line')
    expect(line).toHaveClass('stroke-qb-primary')
  })
})
