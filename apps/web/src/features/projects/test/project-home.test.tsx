import { render, screen, act, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectHome } from '@/features/projects/components/project-home'
import { ProjectKpiRow } from '@/features/projects/components/project-kpi-row'
import { __resetStore } from '@/lib/mock-store'
import type { Project } from '@qably/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockProject: Project = {
  id: 'proj-1',
  name: 'Ecommerce App',
  description: 'Checkout, catalog, and user account flows.',
  githubRepo: 'acme/ecommerce',
  organizationId: 'org-1',
  healthScore: 90,
  lastRunStatus: 'pass',
  lastRunAt: '2026-06-16T10:00:00Z',
  suiteCount: 12,
  activeRunCount: 1,
  aiPendingCount: 3,
  createdAt: '2026-01-20T00:00:00Z',
}

describe('ProjectHome', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders project name and description', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.getByRole('heading', { level: 1, name: 'Ecommerce App' })).toBeInTheDocument()
    expect(screen.getByText(/Checkout, catalog/)).toBeInTheDocument()
  })

  it('renders health + last-run chip in header', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.getByText(/Health 90%/)).toBeInTheDocument()
    // "Pass" appears in the header status chip + multiple suite status chips
    expect(screen.getAllByText('Pass').length).toBeGreaterThan(0)
  })

  it('renders 4 KPIs in ProjectKpiRow', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    const kpiGroup = screen.getByRole('group', { name: /Project health/i })
    expect(within(kpiGroup).getByText('Suites')).toBeInTheDocument()
    expect(within(kpiGroup).getByText('Test Cases')).toBeInTheDocument()
    expect(within(kpiGroup).getByText(/Pass Rate \(7d\)/)).toBeInTheDocument()
    expect(within(kpiGroup).getByText('Last Run')).toBeInTheDocument()
  })

  it('renders 3 "Recent" sections', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.getByText('Recent suites')).toBeInTheDocument()
    expect(screen.getByText('Recent runs')).toBeInTheDocument()
    expect(screen.getByText('Pending AI cases')).toBeInTheDocument()
  })

  it('shows "View all" links for each section', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    const links = screen.getAllByText(/View all/i)
    expect(links.length).toBe(3)
  })

  it('renders recent runs with suite + status', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    // run-12 is in mock data, name "Run #12"
    const runs = screen.getAllByText(/Run #/)
    expect(runs.length).toBeGreaterThan(0)
  })

  it('renders pending AI cases', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    // mockAiCases has 'ai-2' with 'pending' status
    expect(screen.getByText('Checkout with empty cart blocked')).toBeInTheDocument()
  })

  it('renders recent suites with their status chips', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    // proj-1 has 3 suites, all have runs
    const auth = screen.getAllByText('Authentication')
    expect(auth.length).toBeGreaterThan(0)
  })
})

describe('ProjectKpiRow', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders 4 KPI cards', async () => {
    await act(async () => { render(<ProjectKpiRow projectId="proj-1" />) })
    const group = screen.getByRole('group', { name: /Project health/i })
    expect(within(group).getByText('Suites')).toBeInTheDocument()
    expect(within(group).getByText('Test Cases')).toBeInTheDocument()
    expect(within(group).getByText(/Pass Rate \(7d\)/)).toBeInTheDocument()
    expect(within(group).getByText('Last Run')).toBeInTheDocument()
  })

  it('shows project-wide totals', async () => {
    await act(async () => { render(<ProjectKpiRow projectId="proj-1" />) })
    // proj-1 has 3 suites with 3+3+1 = 7 cases
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('shows "—" for Last Run when project has no runs', async () => {
    await act(async () => { render(<ProjectKpiRow projectId="proj-empty" />) })
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
