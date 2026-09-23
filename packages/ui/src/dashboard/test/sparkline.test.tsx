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

    const path = container.querySelector('.recharts-area-curve')
    expect(path).toBeInTheDocument()
    expect(container.querySelectorAll('circle')).toHaveLength(1)
  })

  it('renders an accessible dot for a single value instead of a silent blank', () => {
    render(<Sparkline values={[42]} label="single" />)

    expect(screen.getByRole('img', { name: 'single' })).toBeInTheDocument()
  })

  it('renders no visual and an accessible empty-state name for an empty series', () => {
    render(<Sparkline values={[]} label="trend" emptyLabel="No data" />)

    const image = screen.getByRole('img', { name: 'No data' })
    expect(image).toBeInTheDocument()
    expect(image.querySelector('.recharts-surface')).not.toBeInTheDocument()
  })

  it('renders no visual and an accessible empty-state name when every value is null', () => {
    render(<Sparkline values={[null, null, null]} label="trend" emptyLabel="No data" />)

    const image = screen.getByRole('img', { name: 'No data' })
    expect(image).toBeInTheDocument()
    expect(image.querySelector('.recharts-surface')).not.toBeInTheDocument()
  })

  it('falls back to the label as the accessible name when no emptyLabel is given', () => {
    render(<Sparkline values={[null, null]} label="trend" />)

    expect(screen.getByRole('img', { name: 'trend' })).toBeInTheDocument()
  })

  it('breaks the line into a gap instead of interpolating across a null value', () => {
    const { container } = render(<Sparkline values={[10, null, 30, 60]} label="trend with a gap" />)

    const path = container.querySelector('.recharts-area-curve')
    const commands = (path?.getAttribute('d') ?? '').match(/M/g) ?? []
    expect(commands.length).toBeGreaterThan(1)
  })

  it('marks the last non-null value, not the last array slot, when the series ends with a gap', () => {
    const { container } = render(<Sparkline values={[10, 40, 30, null]} label="trend ending in a gap" />)

    expect(container.querySelectorAll('circle')).toHaveLength(1)
  })

  it('colours the line and the last-value marker by tone through the scoped chart variable', () => {
    const { container } = render(<Sparkline values={[10, 20, 30]} label="trend" tone="fail" />)

    const marker = container.querySelector('circle')
    expect(marker).toHaveAttribute('fill', 'var(--color-value)')
    const path = container.querySelector('.recharts-area-curve')
    expect(path).toHaveAttribute('stroke', 'var(--color-value)')
    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('--color-value: var(--qb-chart-fail);')
  })

  it('defaults the line tone to primary when no tone is given', () => {
    const { container } = render(<Sparkline values={[10, 20, 30]} label="trend" />)

    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('--color-value: var(--qb-chart-line);')
  })

  it('maps the muted tone to the comparison chart token', () => {
    const { container } = render(<Sparkline values={[10, 20, 30]} label="trend" tone="muted" />)

    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('--color-value: var(--qb-chart-compare);')
  })
})
