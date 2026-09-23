import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RunProgressHeader } from '@/features/runs/components/run-progress-header'
import { renderWithQuery } from '@/lib/query-test-utils'
import type { RunRecord } from '@qably/types'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

const mockRun: RunRecord = {
  id: 'run-12',
  projectId: 'proj-1',
  organizationId: 'org-1',
  suiteId: 'suite-1',
  name: 'Run #12',
  status: 'running',
  source: 'manual',
  externalId: '',
  startedAt: '2026-06-16T10:00:00Z',
  finishedAt: '2026-06-16T10:05:00Z',
  delta: null,
  cases: [
    { id: 'tc-1', testCaseId: 'tc-1', officialCase: null, name: 'a', suiteName: 'Authentication', steps: [], expectedResult: '', status: 'pass', position: 0 },
    { id: 'tc-2', testCaseId: 'tc-2', officialCase: null, name: 'b', suiteName: 'Authentication', steps: [], expectedResult: '', status: 'fail', position: 1 },
    { id: 'tc-3', testCaseId: 'tc-3', officialCase: null, name: 'c', suiteName: 'Authentication', steps: [], expectedResult: '', status: 'blocked', position: 2 },
    { id: 'tc-4', testCaseId: 'tc-4', officialCase: null, name: 'd', suiteName: 'Authentication', steps: [], expectedResult: '', status: 'pending', position: 3 },
  ],
}

describe('RunProgressHeader', () => {
  it('renders run name', async () => {
    await act(async () => {
      renderWithQuery(<RunProgressHeader run={mockRun} />)
    })
    expect(screen.getByText('Run #12')).toBeInTheDocument()
  })

  it('renders suite name resolved through the suites api', async () => {
    await act(async () => {
      renderWithQuery(<RunProgressHeader run={mockRun} />)
    })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
  })

  it('renders pass rate in mono font, from pass over decided cases, excluding pending', async () => {
    // 1 pass, 1 fail, 1 blocked, 1 pending → decided = 3, rate = 1/3 → 33%
    await act(async () => {
      renderWithQuery(<RunProgressHeader run={mockRun} />)
    })
    const passRate = screen.getByText('33%')
    expect(passRate).toBeInTheDocument()
    expect(passRate.className).toContain('font-mono')
  })

  it('renders status chip', async () => {
    await act(async () => {
      renderWithQuery(<RunProgressHeader run={mockRun} />)
    })
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('shows the Qably mark instead of a text label on the source chip for manual runs', async () => {
    await act(async () => {
      renderWithQuery(<RunProgressHeader run={mockRun} />)
    })
    const chip = screen.getByTestId('run-source-chip')
    expect(chip).toHaveAttribute('aria-label', 'Manual')
    expect(chip.querySelector('svg')).toBeInTheDocument()
    expect(chip).not.toHaveTextContent('Manual')
  })

  it('renders dates', async () => {
    await act(async () => {
      renderWithQuery(<RunProgressHeader run={mockRun} />)
    })
    // Should show started/finished text
    expect(screen.getByText(/Started/)).toBeInTheDocument()
    expect(screen.getByText(/Finished/)).toBeInTheDocument()
  })

  it('renders the commit author as a plain string, no delete action', async () => {
    await act(async () => {
      renderWithQuery(
        <RunProgressHeader
          run={{
            ...mockRun,
            source: 'github_actions',
            commitSha: 'abc1234',
            commitAuthor: 'Ada Lovelace',
          }}
        />,
      )
    })
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('titles a CI run with its suite name and demotes the commit message to a secondary line, matching the runs list', async () => {
    await act(async () => {
      renderWithQuery(
        <RunProgressHeader
          run={{
            ...mockRun,
            source: 'github_actions',
            commitSha: 'abc1234',
            commitMessage: 'fix: checkout button not disabling on empty cart',
          }}
        />,
      )
    })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('fix: checkout button not disabling on empty cart')).toBeInTheDocument()
    expect(screen.queryByText('Run #12')).not.toBeInTheDocument()
  })

  it('shows only the suite name, with no secondary line, for a CI run with no commit message', async () => {
    await act(async () => {
      renderWithQuery(<RunProgressHeader run={{ ...mockRun, source: 'github_actions' }} />)
    })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.queryByText('Run #12')).not.toBeInTheDocument()
  })

  it('shows the GitHub Actions icon instead of a text label on the source chip for CI runs', async () => {
    await act(async () => {
      renderWithQuery(<RunProgressHeader run={{ ...mockRun, source: 'github_actions' }} />)
    })
    const chip = screen.getByTestId('run-source-chip')
    expect(chip).toHaveAttribute('aria-label', 'CI')
    expect(chip.querySelector('svg')).toBeInTheDocument()
    expect(chip).not.toHaveTextContent('CI')
  })

  it('renders the CI source chip as a bare icon, with no pill card around it', async () => {
    await act(async () => {
      renderWithQuery(<RunProgressHeader run={{ ...mockRun, source: 'github_actions' }} />)
    })
    const chip = screen.getByTestId('run-source-chip')
    expect(chip.className).not.toContain('border')
    expect(chip.className).not.toContain('bg-canvas')
    expect(chip.className).toContain('text-brand-github-actions')
  })

  it('keeps the bordered pill for the api source', async () => {
    await act(async () => {
      renderWithQuery(<RunProgressHeader run={{ ...mockRun, source: 'api' }} />)
    })
    const chip = screen.getByTestId('run-source-chip')
    expect(chip.className).toContain('border')
    expect(chip.className).toContain('bg-canvas')
  })

  it('shows the Qably mark as a bare icon, with no pill card, for manual runs', async () => {
    await act(async () => {
      renderWithQuery(<RunProgressHeader run={{ ...mockRun, source: 'manual' }} />)
    })
    const chip = screen.getByTestId('run-source-chip')
    expect(chip.className).not.toContain('border')
    expect(chip.className).not.toContain('bg-canvas')
    expect(chip.className).toContain('text-primary')
  })
})
