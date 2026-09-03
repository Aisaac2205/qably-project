import * as React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Project } from '@qably/types'

// ── Mock store hooks ─────────────────────────────────────────────
vi.mock('@/lib/use-mock-store', () => ({
  useSuites: vi.fn(() => []),
  useProposals: vi.fn(() => []),
  useReviewDecisions: vi.fn(() => []),
}))

vi.mock('@/features/runs/hooks/use-runs', () => ({
  useRuns: vi.fn(() => ({ runs: [], isLoading: false, isError: false })),
}))

vi.mock('@/features/projects/hooks/use-projects', () => ({
  useProjects: vi.fn(() => ({ projects: [], isLoading: false, isError: false })),
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

  it('renders no local page heading, deferring to the app shell title', async () => {
    const { container } = await act(async () => render(<ReportsPage />))

    // The app shell's TopBar owns the single document h1 for this route
    // (id="page-title"); the page itself must not render a competing one.
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(container.querySelector('[aria-labelledby="page-title"]')).toBeInTheDocument()
  })

  it('renders three chart section headings', async () => {
    await act(async () => {
      render(<ReportsPage />)
    })
    expect(screen.getByText('Pass Rate Over Time')).toBeInTheDocument()
    expect(screen.getByText('Pass / Fail Distribution')).toBeInTheDocument()
    expect(screen.getByText('Proposal Review Status')).toBeInTheDocument()
  })

  it('renders chart containers as Card components', async () => {
    await act(async () => {
      render(<ReportsPage />)
    })
    // Should have at least 3 chart cards (Card components with data-slot="card")
    const cards = document.querySelectorAll('[data-slot="card"]')
    expect(cards.length).toBeGreaterThanOrEqual(3)
  })

  it('mounts the review distribution and recent decisions panels', async () => {
    await act(async () => {
      render(<ReportsPage />)
    })
    expect(screen.getByRole('heading', { name: 'Review distribution' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recent review decisions' })).toBeInTheDocument()
  })
})
