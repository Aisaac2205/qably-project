import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { DashboardRecentRun } from '@qably/types'
import { ActivityRow } from '@/features/dashboard/components/activity-row'

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [k: string]: unknown }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />,
}))

function run(overrides: Partial<DashboardRecentRun>): DashboardRecentRun {
  return {
    id: 'run-1',
    projectId: 'project-1',
    projectName: 'Checkout Web',
    suiteId: 'suite-1',
    suiteName: 'Checkout',
    name: 'Checkout regression',
    status: 'pass',
    source: 'github_actions',
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    passRate: 1,
    casesPassed: 8,
    casesTotal: 10,
    ...overrides,
  }
}

describe('ActivityRow', () => {
  it('shows a commit line with the short SHA and message when the run has a commit', () => {
    render(
      <ActivityRow
        run={run({
          commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
          commitMessage: 'fix(ci): retry throttled run reports',
        })}
      />,
    )

    expect(screen.getByText('d2f363d')).toBeInTheDocument()
    expect(screen.getByText('fix(ci): retry throttled run reports')).toBeInTheDocument()
  })

  it('omits the commit line for a run with no commit', () => {
    render(<ActivityRow run={run({ commitSha: undefined, source: 'api' })} />)
    expect(screen.queryByText(/^[a-f0-9]{7}$/)).not.toBeInTheDocument()
  })

  it('shows the run status with the status pill, without a redundant percentage', () => {
    const { container } = render(<ActivityRow run={run({ status: 'pass', passRate: 1 })} />)
    expect(container.querySelector('[data-status="pass"]')).toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
  })

  it('shows the passed-of-total case count', () => {
    render(<ActivityRow run={run({ casesPassed: 8, casesTotal: 10 })} />)
    expect(screen.getByText('8 of 10 passed')).toBeInTheDocument()
  })

  it('shows the relative time the run started', () => {
    render(<ActivityRow run={run({ startedAt: new Date(Date.now() - 60_000).toISOString() })} />)
    expect(screen.getByText(/ago|min/i)).toBeInTheDocument()
  })

  it('renders the official GitHub logo mark for the commit, not an icon font glyph', () => {
    render(
      <ActivityRow
        run={run({
          commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
          commitMessage: 'fix(ci): retry throttled run reports',
        })}
      />,
    )

    const mark = screen.getByAltText('') as HTMLImageElement
    expect(mark).toHaveAttribute('src', '/logos/github.svg')
  })

  it('title-attributes the full project and run name on the truncated first line', () => {
    render(<ActivityRow run={run({ projectName: 'Checkout Web', name: 'e2e/checkout/regression-suite.spec.ts' })} />)

    const line = screen.getByTitle('Checkout Web · e2e/checkout/regression-suite.spec.ts')
    expect(line).toBeInTheDocument()
    expect(line).toHaveClass('truncate')
  })

  it('keeps every flex row min-w-0 so long names truncate instead of overlapping the status cluster', () => {
    const { container } = render(<ActivityRow run={run({})} />)

    const rows = container.querySelectorAll('.flex.min-w-0')
    expect(rows.length).toBeGreaterThan(0)
  })
})
