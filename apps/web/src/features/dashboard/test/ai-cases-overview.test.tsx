import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// ── Mock Recharts to avoid jsdom SVG issues ──────────────────────
vi.mock('recharts', () => {
  const MockResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  )
  return {
    PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
    Pie: () => <div />,
    Cell: () => <div />,
    ResponsiveContainer: MockResponsiveContainer,
  }
})

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

import { AiCasesOverview } from '@/features/dashboard/components/ai-cases-overview'

describe('AiCasesOverview', () => {
  it('renders the title "AI cases overview"', async () => {
    await act(async () => {
      render(<AiCasesOverview />)
    })
    expect(screen.getByText('AI cases overview')).toBeInTheDocument()
  })

  it('renders the total count in the center of the donut', async () => {
    await act(async () => {
      render(<AiCasesOverview />)
    })
    // Total = 24 + 18 + 8 + 6 = 56
    expect(screen.getByText('56')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('renders the donut chart container after mount', async () => {
    await act(async () => {
      render(<AiCasesOverview />)
    })
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders all 4 legend items with values', async () => {
    await act(async () => {
      render(<AiCasesOverview />)
    })
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Generated')).toBeInTheDocument()
    expect(screen.getByText('In review')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    // Values
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })
})
