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
})
