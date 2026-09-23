import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { DashboardActivityEntry } from '@qably/types'
import { ActivityRow } from '@/features/dashboard/components/activity-row'

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [k: string]: unknown }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />,
}))

function commitEntry(overrides: Partial<DashboardActivityEntry> = {}): DashboardActivityEntry {
  return {
    kind: 'commit',
    projectId: 'project-1',
    projectName: 'Checkout Web',
    status: 'pass',
    source: 'github_actions',
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    casesPassed: 12,
    casesTotal: 12,
    commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
    commitMessage: 'fix(ci): retry throttled run reports',
    suiteCount: 2,
    ...overrides,
  } as DashboardActivityEntry
}

function runEntry(overrides: Partial<DashboardActivityEntry> = {}): DashboardActivityEntry {
  return {
    kind: 'run',
    projectId: 'project-2',
    projectName: 'Mobile App',
    status: 'fail',
    source: 'api',
    occurredAt: new Date(Date.now() - 300_000).toISOString(),
    casesPassed: 3,
    casesTotal: 5,
    runId: 'run-2',
    runName: 'Auth smoke',
    suiteName: 'Auth',
    ...overrides,
  } as DashboardActivityEntry
}

describe('ActivityRow', () => {
  it('shows a commit line with the short SHA and message when the entry is a commit', () => {
    render(<ActivityRow entry={commitEntry()} />)

    expect(screen.getByText('d2f363d')).toBeInTheDocument()
    expect(screen.getByText('fix(ci): retry throttled run reports')).toBeInTheDocument()
  })

  it('omits the commit line for a run entry', () => {
    render(<ActivityRow entry={runEntry()} />)
    expect(screen.queryByText(/^[a-f0-9]{7}$/)).not.toBeInTheDocument()
  })

  it('shows the entry status with the status pill', () => {
    const { container } = render(<ActivityRow entry={commitEntry({ status: 'pass' })} />)
    expect(container.querySelector('[data-status="pass"]')).toBeInTheDocument()
  })

  it('shows the suites and cases summary for a grouped commit', () => {
    render(<ActivityRow entry={commitEntry({ suiteCount: 2, casesPassed: 12, casesTotal: 12 })} />)
    expect(screen.getByText('2 suites · 12/12 cases')).toBeInTheDocument()
  })

  it('uses the singular suite word for a single-suite commit', () => {
    render(<ActivityRow entry={commitEntry({ suiteCount: 1, casesPassed: 6, casesTotal: 6 })} />)
    expect(screen.getByText('1 suite · 6/6 cases')).toBeInTheDocument()
  })

  it('formats large suite and case counts with locale-aware thousand separators', () => {
    render(<ActivityRow entry={commitEntry({ suiteCount: 356, casesPassed: 1234, casesTotal: 1300 })} />)
    expect(screen.getByText('356 suites · 1,234/1,300 cases')).toBeInTheDocument()
  })

  it('shows the passed-of-total case count for a run entry', () => {
    render(<ActivityRow entry={runEntry({ casesPassed: 3, casesTotal: 5 })} />)
    expect(screen.getByText('3 of 5 passed')).toBeInTheDocument()
  })

  it('shows the relative time the entry occurred', () => {
    render(<ActivityRow entry={commitEntry({ occurredAt: new Date(Date.now() - 60_000).toISOString() })} />)
    expect(screen.getByText(/ago|min/i)).toBeInTheDocument()
  })

  it('renders the official GitHub logo mark for a commit entry, not an icon font glyph', () => {
    render(<ActivityRow entry={commitEntry()} />)

    const mark = screen.getByAltText('') as HTMLImageElement
    expect(mark).toHaveAttribute('src', '/logos/github.svg')
  })

  it('title-attributes the project name for a commit entry', () => {
    render(<ActivityRow entry={commitEntry({ projectName: 'Checkout Web' })} />)

    const line = screen.getByTitle('Checkout Web')
    expect(line).toBeInTheDocument()
    expect(line).toHaveClass('truncate')
  })

  it('title-attributes the project and run name for a run entry', () => {
    render(<ActivityRow entry={runEntry({ projectName: 'Mobile App', runName: 'Auth smoke' })} />)

    const line = screen.getByTitle('Mobile App · Auth smoke')
    expect(line).toBeInTheDocument()
  })

  it('names the source wrapper for assistive tech', () => {
    render(<ActivityRow entry={runEntry({ source: 'api' })} />)
    expect(screen.getByRole('img', { name: 'API' })).toBeInTheDocument()
  })
})
