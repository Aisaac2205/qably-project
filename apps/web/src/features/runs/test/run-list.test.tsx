import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RunList } from '@/features/runs/components/run-list'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('RunList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the manual runs of a project', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-1" />)
    })

    expect(screen.getByText('Run #12')).toBeInTheDocument()
    expect(screen.getByText('Run #11')).toBeInTheDocument()
  })

  it('never lists an automated run, reported by CI or sent through the API', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-1" />)
    })

    expect(screen.queryByText('Run #9')).not.toBeInTheDocument()
    expect(screen.queryByText('Run #10')).not.toBeInTheDocument()
    expect(screen.queryByText(/checkout button not disabling/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Fail')).not.toBeInTheDocument()
  })

  it('sorts runs by startedAt descending', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-1" />)
    })
    const runNames = screen.getAllByText(/Run #/)

    expect(runNames[0]).toHaveTextContent('Run #12')
    expect(runNames[runNames.length - 1]).toHaveTextContent('Run #11')
  })

  it('renders status chips for each run', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-1" />)
    })

    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('renders pass rate in mono font', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-1" />)
    })
    const passRates = screen.getAllByText('100%')

    expect(passRates.length).toBeGreaterThan(0)
    expect(passRates[0].className).toContain('font-mono')
  })

  it('renders links to run detail', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-1" />)
    })
    const link = screen.getByRole('link', { name: /Run #12/ })

    expect(link.getAttribute('href')).toBe('/projects/proj-1/runs/run-12')
  })

  it('shows the manual empty state for a project with no manual runs', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-4" />)
    })

    expect(screen.getByText('Run your manual cases')).toBeInTheDocument()
  })

  it('reads the suite name off the run, with no suites api mocked at all', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-1" />)
    })

    expect(screen.getAllByText('Authentication').length).toBeGreaterThan(0)
  })

  it('hides the load-more control when the api reports no further page', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-1" />)
    })

    expect(
      screen.queryByRole('button', { name: /load more/i }),
    ).not.toBeInTheDocument()
  })
})

describe('RunList evidence', () => {
  it('shows the Qably mark instead of a text badge for a manual run', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-1" />)
    })

    expect(screen.queryByText('manual')).not.toBeInTheDocument()
    expect(screen.getAllByTitle('Qably').length).toBeGreaterThan(0)
  })

  it('shows no automation icon or source badge, since an automated run never reaches this list', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-1" />)
    })

    expect(screen.queryByTitle('GitHub Actions')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('CI')).not.toBeInTheDocument()
    expect(screen.queryByText('github actions')).not.toBeInTheDocument()
    expect(screen.queryByText('api')).not.toBeInTheDocument()
  })

  it('omits the delta chip when a run has nothing to compare against', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-1" />)
    })

    expect(screen.queryByRole('group', { name: /changes since the previous run/i })).not.toBeInTheDocument()
  })

  it('never points to the CI reporting guide, because CI runs do not appear here', async () => {
    await act(async () => {
      renderWithQuery(<RunList projectId="proj-empty" />)
    })

    expect(screen.queryByText(/ci fills this page automatically/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /how to report results from ci/i })).not.toBeInTheDocument()
  })
})
