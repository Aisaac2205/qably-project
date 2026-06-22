import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RunList } from '@/features/runs/components/run-list'
import { __resetStore } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('RunList', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders runs for a project', async () => {
    await act(async () => {
      render(<RunList projectId="proj-1" />)
    })
    // proj-1 has 4 runs: run-12, run-11, run-10, run-9
    expect(screen.getByText('Run #12')).toBeInTheDocument()
    expect(screen.getByText('Run #11')).toBeInTheDocument()
    expect(screen.getByText('Run #10')).toBeInTheDocument()
    expect(screen.getByText('Run #9')).toBeInTheDocument()
  })

  it('sorts runs by startedAt descending', async () => {
    await act(async () => {
      render(<RunList projectId="proj-1" />)
    })
    const runNames = screen.getAllByText(/Run #/)
    // run-12 has latest startedAt (2026-06-16)
    expect(runNames[0]).toHaveTextContent('Run #12')
    // run-9 has oldest startedAt (2026-06-13)
    expect(runNames[runNames.length - 1]).toHaveTextContent('Run #9')
  })

  it('renders status chips for each run', async () => {
    await act(async () => {
      render(<RunList projectId="proj-1" />)
    })
    expect(screen.getByText('Running')).toBeInTheDocument()
    // Multiple runs with "Pass" status
    const passChips = screen.getAllByText('Pass')
    expect(passChips.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Fail')).toBeInTheDocument()
  })

  it('renders pass rate in mono font', async () => {
    await act(async () => {
      render(<RunList projectId="proj-1" />)
    })
    const passRates = screen.getAllByText('100%')
    expect(passRates.length).toBeGreaterThan(0)
    expect(passRates[0].className).toContain('font-mono')
  })

  it('renders links to run detail', async () => {
    await act(async () => {
      render(<RunList projectId="proj-1" />)
    })
    const link = screen.getByRole('link', { name: /Run #12/ })
    expect(link.getAttribute('href')).toBe('/projects/proj-1/runs/run-12')
  })

  it('shows empty state for project with no runs', async () => {
    await act(async () => {
      render(<RunList projectId="proj-4" />)
    })
    expect(screen.getByText('No runs yet')).toBeInTheDocument()
  })

  it('filters runs by source when source prop provided', async () => {
    await act(async () => {
      render(<RunList projectId="proj-1" source="github_actions" />)
    })
    // Only run-10 has source=github_actions
    expect(screen.getByText('Run #10')).toBeInTheDocument()
    // run-11, run-9 have different sources — should NOT appear
    expect(screen.queryByText('Run #12')).not.toBeInTheDocument()
    expect(screen.queryByText('Run #11')).not.toBeInTheDocument()
    expect(screen.queryByText('Run #9')).not.toBeInTheDocument()
  })

  it('shows all runs when source prop omitted', async () => {
    await act(async () => {
      render(<RunList projectId="proj-1" />)
    })
    // No source filter — all 4 runs visible
    expect(screen.getByText('Run #12')).toBeInTheDocument()
    expect(screen.getByText('Run #11')).toBeInTheDocument()
    expect(screen.getByText('Run #10')).toBeInTheDocument()
    expect(screen.getByText('Run #9')).toBeInTheDocument()
  })

  it('shows empty state when source filter matches no runs', async () => {
    await act(async () => {
      render(<RunList projectId="proj-1" source="api" />)
    })
    // proj-1 has run-9 with source=api — so should show that
    expect(screen.getByText('Run #9')).toBeInTheDocument()
    // non-api runs should not appear
    expect(screen.queryByText('Run #10')).not.toBeInTheDocument()
  })

  it('filters correctly for manual source', async () => {
    await act(async () => {
      render(<RunList projectId="proj-1" source="manual" />)
    })
    // run-12 and run-11 are manual
    expect(screen.getByText('Run #12')).toBeInTheDocument()
    expect(screen.getByText('Run #11')).toBeInTheDocument()
    // github_actions and api runs should not appear
    expect(screen.queryByText('Run #10')).not.toBeInTheDocument()
    expect(screen.queryByText('Run #9')).not.toBeInTheDocument()
  })
})
