import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Sparkline } from '@/features/suites/components/sparkline'

const sampleData = [
  { date: '2026-06-10', passRate: 60 },
  { date: '2026-06-11', passRate: 70 },
  { date: '2026-06-12', passRate: 80 },
  { date: '2026-06-13', passRate: 0 },
  { date: '2026-06-14', passRate: 90 },
  { date: '2026-06-15', passRate: 85 },
  { date: '2026-06-16', passRate: 75 },
]

describe('Sparkline', () => {
  it('renders an SVG with role="img"', async () => {
    await act(async () => {
      render(<Sparkline data={sampleData} />)
    })
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('renders 7 dots for 7 data points', async () => {
    await act(async () => {
      render(<Sparkline data={sampleData} />)
    })
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`sparkline-dot-${i}`)).toBeInTheDocument()
    }
  })

  it('renders a polyline with the points', async () => {
    await act(async () => {
      render(<Sparkline data={sampleData} />)
    })
    // The polyline has data-testid starting with "sparkline-line-"
    const lines = document.querySelectorAll('polyline')
    expect(lines.length).toBe(1)
    const line = lines[0]!
    const points = line.getAttribute('points')
    expect(points).toBeTruthy()
    // 7 points → 7 coordinate pairs
    expect(points!.split(' ').length).toBe(7)
  })

  it('uses a default aria-label that includes the average pass rate', async () => {
    await act(async () => {
      render(<Sparkline data={sampleData} />)
    })
    // Average is (60+70+80+0+90+85+75)/7 = 460/7 = 65.7 → rounds to 66
    const svg = screen.getByRole('img')
    expect(svg.getAttribute('aria-label')).toMatch(/66%/)
  })

  it('honors a custom aria-label', async () => {
    await act(async () => {
      render(<Sparkline data={sampleData} ariaLabel="Custom label" />)
    })
    expect(screen.getByLabelText('Custom label')).toBeInTheDocument()
  })

  it('renders empty state when data is empty', async () => {
    await act(async () => {
      render(<Sparkline data={[]} />)
    })
    const svg = screen.getByRole('img')
    expect(svg.getAttribute('aria-label')).toBe('No data')
    expect(document.querySelectorAll('polyline').length).toBe(0)
    expect(document.querySelectorAll('circle').length).toBe(0)
  })

  it('renders flat baseline when all data is 0', async () => {
    const allZero = sampleData.map((d) => ({ ...d, passRate: 0 }))
    await act(async () => {
      render(<Sparkline data={allZero} />)
    })
    const line = document.querySelector('polyline')!
    const points = line.getAttribute('points')!
    // All y values should be at the bottom (height=24 → y=24 for passRate=0)
    const coords = points.split(' ').map((p) => p.split(',')[1])
    coords.forEach((y) => {
      expect(parseFloat(y!)).toBeCloseTo(24, 1)
    })
  })

  it('applies the tone class to the polyline', async () => {
    await act(async () => {
      render(<Sparkline data={sampleData} tone="pass" />)
    })
    const line = document.querySelector('polyline')!
    expect(line.getAttribute('class') ?? '').toContain('text-pass')
  })

  it('respects custom width/height via SVG attributes', async () => {
    await act(async () => {
      render(<Sparkline data={sampleData} width={120} height={40} />)
    })
    const svg = screen.getByRole('img')
    expect(svg.getAttribute('width')).toBe('120')
    expect(svg.getAttribute('height')).toBe('40')
    expect(svg.getAttribute('viewBox')).toBe('0 0 120 40')
  })
})
