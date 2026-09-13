import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sparkline } from '../sparkline'

describe('Sparkline', () => {
  it('is an image with an accessible name, never a decorative squiggle', () => {
    render(<Sparkline values={[10, 40, 30, 60]} label="Pass rate over the last 4 runs" />)

    expect(screen.getByRole('img', { name: 'Pass rate over the last 4 runs' })).toBeInTheDocument()
  })

  it('plots one point per value and marks only the last one', () => {
    const { container } = render(<Sparkline values={[10, 40, 30, 60]} label="trend" />)

    const points = container.querySelector('polyline')?.getAttribute('points')?.trim().split(/\s+/)
    expect(points).toHaveLength(4)
    expect(container.querySelectorAll('circle')).toHaveLength(1)
  })

  it('draws a flat line rather than dividing by zero when every value is equal', () => {
    const { container } = render(<Sparkline values={[50, 50, 50]} label="flat" />)

    const ys = container
      .querySelector('polyline')
      ?.getAttribute('points')
      ?.trim()
      .split(/\s+/)
      .map((pair) => Number(pair.split(',')[1]))
    expect(new Set(ys).size).toBe(1)
    expect(ys?.every((y) => Number.isFinite(y))).toBe(true)
  })

  it('renders nothing for fewer than two values', () => {
    const { container } = render(<Sparkline values={[42]} label="single" />)

    expect(container).toBeEmptyDOMElement()
  })
})
