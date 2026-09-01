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
  cases: [
    { id: 'tc-1', testCaseId: 'tc-1', name: 'a', suiteName: 'Authentication', steps: [], expectedResult: '', status: 'pass', position: 0 },
    { id: 'tc-2', testCaseId: 'tc-2', name: 'b', suiteName: 'Authentication', steps: [], expectedResult: '', status: 'pending', position: 1 },
    { id: 'tc-3', testCaseId: 'tc-3', name: 'c', suiteName: 'Authentication', steps: [], expectedResult: '', status: 'pending', position: 2 },
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

  it('renders pass rate in mono font, derived from the case statuses', async () => {
    // 1 pass out of 3 cases in mockRun → 33%
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

  it('renders source label', async () => {
    await act(async () => {
      renderWithQuery(<RunProgressHeader run={mockRun} />)
    })
    // Source is rendered as a human-readable label: manual → Manual
    expect(screen.getByText('Manual')).toBeInTheDocument()
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
})
