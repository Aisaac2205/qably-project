import * as React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Project } from '@qably/types'

// ── Mock store hooks ─────────────────────────────────────────────
vi.mock('@/lib/use-mock-store', () => ({
  useRuns: vi.fn(() => []),
  useSuites: vi.fn(() => []),
  useAiCases: vi.fn(() => []),
}))

// ── Mock the project context ─────────────────────────────────────
const mockContext = { projectId: 'proj-1', project: undefined as Project | undefined }
vi.mock('@/features/projects/context/project-context', () => ({
  useProjectContext: () => mockContext,
  ProjectProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// ── Mock Recharts to avoid jsdom SVG issues ──────────────────────
vi.mock('recharts', () => {
  const MockResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  )
  return {
    LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
    Line: () => <div />,
    BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => <div />,
    Cell: () => <div />,
    PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
    Pie: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
    ResponsiveContainer: MockResponsiveContainer,
    Legend: () => <div />,
  }
})

// ── Import the component under test last, after all mocks are set ─
import { ReportsPage } from '../components/reports-page'

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page header "Reports"', async () => {
    await act(async () => {
      render(<ReportsPage />)
    })
    expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument()
  })

  it('renders three chart section headings', async () => {
    await act(async () => {
      render(<ReportsPage />)
    })
    expect(screen.getByText('Pass Rate Over Time')).toBeInTheDocument()
    expect(screen.getByText('Pass / Fail Distribution')).toBeInTheDocument()
    expect(screen.getByText('AI Case Review Status')).toBeInTheDocument()
  })

  it('renders chart containers with border and background', async () => {
    await act(async () => {
      render(<ReportsPage />)
    })
    // Should have at least 3 chart card wrappers (rounded-md border)
    const cards = document.querySelectorAll('.rounded-md.border.border-border')
    expect(cards.length).toBeGreaterThanOrEqual(3)
  })
})
