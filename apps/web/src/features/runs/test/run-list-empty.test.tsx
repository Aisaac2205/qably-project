import { screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RunList } from '@/features/runs/components/run-list'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/runs/api/runs.api', async () => await import('@/test/runs-api-stub'))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const NEW_RUN_HREF = '/projects/proj-empty/runs/new'

function linkTargets(): (string | null)[] {
  return screen.queryAllByRole('link').map((link) => link.getAttribute('href'))
}

describe('RunList empty state', () => {
  it('offers no way to start a run when the project has no manual cases', async () => {
    renderWithQuery(<RunList projectId="proj-empty" hasManualCases={false} />)

    expect(await screen.findByText('No runs yet')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Start a run' })).not.toBeInTheDocument()
    expect(linkTargets()).not.toContain(NEW_RUN_HREF)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps its message and the guide to reporting from CI when it hides the start link', async () => {
    renderWithQuery(<RunList projectId="proj-empty" hasManualCases={false} />)

    expect(await screen.findByText(/ci fills this page automatically/i)).toBeInTheDocument()
    const guide = screen.getByRole('link', { name: /how to report results from ci/i })
    expect(guide).toHaveAttribute('href', expect.stringContaining('#step-4-report-ci'))
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it.each<[string, boolean | undefined]>([
    ['has manual cases', true],
    ['has not said whether it has manual cases', undefined],
  ])('still links to the new run page when the project %s', async (_label, hasManualCases) => {
    renderWithQuery(<RunList projectId="proj-empty" hasManualCases={hasManualCases} />)

    const link = await screen.findByRole('link', { name: 'Start a run' })
    expect(link).toHaveAttribute('href', NEW_RUN_HREF)
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('leaves a list that has rows alone, whatever the project says about manual cases', async () => {
    renderWithQuery(<RunList projectId="proj-1" hasManualCases={false} />)

    expect(await screen.findByText('Run #12')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Run #12/ })).toHaveAttribute(
      'href',
      '/projects/proj-1/runs/run-12',
    )
    expect(screen.queryByText('No runs yet')).not.toBeInTheDocument()
  })
})
