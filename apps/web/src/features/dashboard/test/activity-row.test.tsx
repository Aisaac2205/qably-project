import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { DashboardRecentRun } from '@qably/types'
import { ActivityRow } from '@/features/dashboard/components/activity-row'

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

  it('shows the run status and the formatted pass rate', () => {
    const { container } = render(<ActivityRow run={run({ status: 'pass', passRate: 1 })} />)
    expect(container.querySelector('[data-status="pass"]')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('shows a dash for the pass rate of an in-flight run', () => {
    render(<ActivityRow run={run({ status: 'running', passRate: null })} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows the relative time the run started', () => {
    render(<ActivityRow run={run({ startedAt: new Date(Date.now() - 60_000).toISOString() })} />)
    expect(screen.getByText(/ago|min/i)).toBeInTheDocument()
  })
})
