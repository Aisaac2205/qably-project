import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CiRunSummaryRecord } from '@qably/types'
import { CiRunRow } from '@/features/runs/components/ci-run-row'
import { useI18nStore } from '@/lib/i18n/store'
import { NOW, PROJECT, ciRunSummary } from './ci-run-fixtures'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function renderRows(items: CiRunSummaryRecord[], now = NOW.getTime()) {
  return render(
    <ul>
      {items.map((ciRun) => (
        <li key={ciRun.id}>
          <CiRunRow ciRun={ciRun} projectId={PROJECT} now={now} />
        </li>
      ))}
    </ul>,
  )
}

function rows(): HTMLElement[] {
  return screen.getAllByRole('link')
}

describe('CiRunRow', () => {
  it('is one link to the detail page of the CI run with nothing interactive inside', () => {
    renderRows([ciRunSummary('ci-1')])

    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveAttribute('href', '/projects/proj-1/runs/ci/ci-1')
    expect(rows()[0].querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull()
  })

  it('shows the status, title, meta line, approximate duration and freshness of the run and nothing else', () => {
    renderRows([ciRunSummary('ci-1')])

    expect(rows()[0]).toHaveTextContent(
      'Has failuresFix flaky checkoutCI #42·main·a1b2c3d·ana~5 minLast report 5 min ago',
    )
  })

  it('shows the passing status of a run without failures', () => {
    renderRows([ciRunSummary('ci-1', { status: 'passing' })])

    expect(rows()[0]).toHaveTextContent(/^No failuresFix flaky checkout/)
  })

  it('puts the freshness in a time element carrying the report timestamp', () => {
    renderRows([ciRunSummary('ci-1')])

    const freshness = screen.getByText('Last report 5 min ago')
    expect(freshness.tagName).toBe('TIME')
    expect(freshness).toHaveAttribute('datetime', '2026-10-03T11:55:00.000Z')
  })

  it('derives the freshness from the clock it is given', () => {
    const run = ciRunSummary('ci-1', { lastReportedAt: '2026-10-03T11:59:55.000Z' })
    const { rerender } = renderRows([run])

    expect(screen.getByText('Last report 5 s ago')).toBeInTheDocument()

    rerender(
      <ul>
        <li>
          <CiRunRow ciRun={run} projectId={PROJECT} now={NOW.getTime() + 55_000} />
        </li>
      </ul>,
    )

    expect(screen.getByText('Last report 1 min ago')).toBeInTheDocument()
  })

  it('degrades a backfilled CI run that only carries commit fields', () => {
    renderRows([
      ciRunSummary('ci-1', {
        status: 'passing',
        externalId: '901',
        startedAt: '2026-10-03T11:55:00.000Z',
        runNumber: undefined,
        branch: undefined,
        commitMessage: 'Add the invoice export',
      }),
    ])

    expect(rows()[0]).toHaveTextContent('No failuresAdd the invoice exporta1b2c3d·anaLast report 5 min ago')
    expect(rows()[0].textContent).not.toMatch(/CI #|null|undefined|-/)
  })

  it('falls back to the workflow name, then the short SHA, then the run id for the title', () => {
    const bare = {
      commitMessage: undefined,
      runNumber: undefined,
      branch: undefined,
      commitSha: undefined,
      commitAuthor: undefined,
    }
    renderRows([
      ciRunSummary('ci-1', { ...bare, workflowName: 'Nightly' }),
      ciRunSummary('ci-2', { ...bare, commitSha: 'b2c3d4e5f6a7' }),
      ciRunSummary('ci-3', { ...bare, externalId: 'run-77' }),
    ])

    const [nightly, sha, id] = rows()
    expect(nightly).toHaveTextContent('Has failuresNightly~5 minLast report 5 min ago')
    expect(sha).toHaveTextContent('Has failuresb2c3d4eb2c3d4e~5 minLast report 5 min ago')
    expect(id).toHaveTextContent('Has failuresrun-77~5 minLast report 5 min ago')
  })

  it('renders no duration when the first and last report share a second', () => {
    renderRows([ciRunSummary('ci-1', { startedAt: '2026-10-03T11:55:00.400Z' })])

    expect(rows()[0]).toHaveTextContent(
      'Has failuresFix flaky checkoutCI #42·main·a1b2c3d·anaLast report 5 min ago',
    )
    expect(screen.queryByText(/^~/)).not.toBeInTheDocument()
  })

  it('composes a duration made of hours and minutes', () => {
    renderRows([ciRunSummary('ci-1', { startedAt: '2026-10-03T10:50:00.000Z' })])

    expect(screen.getByText('~1 h 5 min')).toBeInTheDocument()
  })

  it('shows what the duration measures in a tooltip without adding a tab stop to the row', async () => {
    const user = userEvent.setup()
    renderRows([ciRunSummary('ci-1'), ciRunSummary('ci-2', { status: 'passing' })])

    const duration = screen.getAllByText('~5 min')[0]
    expect(duration).not.toHaveAttribute('tabindex')

    await user.hover(duration)
    expect(
      await screen.findByText('Approximate: between the first and the last report'),
    ).toBeInTheDocument()

    await user.tab()
    expect(rows()[0]).toHaveFocus()
    await user.tab()
    expect(rows()[1]).toHaveFocus()
  })

  it('translates the copy with the active locale', () => {
    useI18nStore.setState({ locale: 'es' })

    renderRows([ciRunSummary('ci-1')])

    expect(screen.getByText('Con fallos')).toBeInTheDocument()
    expect(screen.getByText('Último reporte hace 5 min')).toBeInTheDocument()
  })

  it('is at least 44px tall and keeps a visible focus ring', () => {
    renderRows([ciRunSummary('ci-1')])

    expect(rows()[0]).toHaveClass('min-h-11', 'focus-visible:outline-2')
  })
})
