import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CiRunSummaryRecord } from '@qably/types'
import { CiRunHeader } from '@/features/runs/components/ci-run-header'
import { useI18nStore } from '@/lib/i18n/store'
import { NOW, ciRunSummary } from './ci-run-fixtures'

const GITHUB: Partial<CiRunSummaryRecord> = {
  workflowName: 'CI',
  serverUrl: 'https://github.com',
  repository: 'acme/shop',
  externalId: '900',
}

function renderHeader(overrides: Partial<CiRunSummaryRecord> = {}) {
  return render(<CiRunHeader ciRun={ciRunSummary('ci-1', { ...GITHUB, ...overrides })} />)
}

describe('CiRunHeader summary', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('titles the run with the first line of its commit message below the page heading', () => {
    renderHeader()

    expect(screen.getByRole('heading', { level: 2, name: 'Fix flaky checkout' })).toBeInTheDocument()
  })

  it('shows the status, the CI number, ref, short SHA and author', () => {
    renderHeader()

    expect(screen.getByText('Has failures')).toBeInTheDocument()
    expect(screen.getByText('CI #42')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('a1b2c3d')).toBeInTheDocument()
    expect(screen.getByText('ana')).toBeInTheDocument()
  })

  it('shows the passing status of a run without failures', () => {
    renderHeader({ status: 'passing' })

    expect(screen.getByText('No failures')).toBeInTheDocument()
    expect(screen.queryByText('Has failures')).not.toBeInTheDocument()
  })

  it('shows the workflow next to the timing when it is not already the title', () => {
    renderHeader({ workflowName: 'Release' })

    expect(screen.getByText('Release')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Fix flaky checkout')
  })

  it('does not repeat the workflow when it already is the title', () => {
    renderHeader({ commitMessage: undefined, workflowName: 'Nightly' })

    expect(screen.getByRole('heading', { level: 2, name: 'Nightly' })).toBeInTheDocument()
    expect(screen.getAllByText('Nightly')).toHaveLength(1)
  })

  it('shows the approximate duration and the freshness of the last report', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setInterval', 'clearInterval'] })
    renderHeader()

    expect(screen.getByText('~5 min')).toBeInTheDocument()
    const freshness = screen.getByText('Last report 5 min ago')
    expect(freshness.tagName).toBe('TIME')
    expect(freshness).toHaveAttribute('datetime', '2026-10-03T11:55:00.000Z')
  })

  it('renders no duration when the first and last report share a second', () => {
    renderHeader({ startedAt: '2026-10-03T11:55:00.200Z' })

    expect(screen.queryByText(/^~/)).not.toBeInTheDocument()
  })

  it('keeps the freshness current as the clock moves', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setInterval', 'clearInterval'] })
    renderHeader({ lastReportedAt: '2026-10-03T11:59:55.000Z' })

    expect(screen.getByText('Last report 5 s ago')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(screen.getByText('Last report 15 s ago')).toBeInTheDocument()
  })

  it('degrades a backfilled run that only carries commit fields', () => {
    const { container } = renderHeader({
      workflowName: undefined,
      runNumber: undefined,
      branch: undefined,
      serverUrl: undefined,
      repository: undefined,
      startedAt: '2026-10-03T11:55:00.000Z',
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Fix flaky checkout' })).toBeInTheDocument()
    expect(screen.getByText('a1b2c3d')).toBeInTheDocument()
    expect(screen.getByText('ana')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/CI #|null|undefined/)
  })

  it('translates the header with the active locale', () => {
    useI18nStore.setState({ locale: 'es' })

    renderHeader({ status: 'passing' })

    expect(screen.getByText('Sin fallos')).toBeInTheDocument()
    expect(screen.getByText('Último reporte hace', { exact: false })).toBeInTheDocument()
  })
})

describe('CiRunHeader tooltips', () => {
  it('explains the status in a tooltip that keyboard users reach and that hides on Escape', async () => {
    const user = userEvent.setup()
    renderHeader()

    expect(screen.queryByText(/Based on the reports received so far/)).not.toBeInTheDocument()

    await user.tab()

    const trigger = screen.getByText('Has failures').closest('[tabindex="0"]')
    expect(trigger).toHaveFocus()
    expect(
      await screen.findByText(
        'Based on the reports received so far. Jobs that do not upload a test report are not shown.',
      ),
    ).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByText(/Based on the reports received so far/)).not.toBeInTheDocument()
  })

  it('explains the status on hover as well', async () => {
    const user = userEvent.setup()
    renderHeader({ status: 'passing' })

    await user.hover(screen.getByText('No failures'))

    expect(await screen.findByText(/Based on the reports received so far/)).toBeInTheDocument()
  })

  it('explains what the duration measures to keyboard users too', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.tab()
    await user.tab()

    expect(screen.getByText('~5 min')).toHaveFocus()
    expect(
      await screen.findByText('Approximate: between the first and the last report'),
    ).toBeInTheDocument()
  })
})

describe('CiRunHeader GitHub link', () => {
  it('links to the run on GitHub in a new tab, naming the repository and the host', () => {
    renderHeader()

    const link = screen.getByRole('link', {
      name: 'Open the acme/shop run on github.com (opens in a new tab)',
    })
    expect(link).toHaveAttribute('href', 'https://github.com/acme/shop/actions/runs/900')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveTextContent('acme/shop')
  })

  it('hides every icon of the link from assistive technology', () => {
    renderHeader()

    const icons = screen.getByRole('link').querySelectorAll('svg')
    expect(icons.length).toBeGreaterThan(0)
    for (const icon of icons) {
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('names the host of a self-hosted server in the link', () => {
    renderHeader({ serverUrl: 'https://git.acme.dev:8443/ignored/path?token=1' })

    expect(
      screen.getByRole('link', {
        name: 'Open the acme/shop run on git.acme.dev:8443 (opens in a new tab)',
      }),
    ).toHaveAttribute('href', 'https://git.acme.dev:8443/acme/shop/actions/runs/900')
  })

  it.each([
    ['the server URL is missing', { serverUrl: undefined }],
    ['the repository is missing', { repository: undefined }],
    ['the repository is blank', { repository: '  ' }],
    ['the server URL is not http or https', { serverUrl: 'javascript:alert(1)' }],
    ['the server URL is an ftp address', { serverUrl: 'ftp://github.com' }],
    ['the run was reported through the API', { source: 'api' as const }],
    ['the repository holds a dot segment', { repository: 'acme/..' }],
    ['the run id holds a dot segment', { externalId: '..' }],
  ] as [string, Partial<CiRunSummaryRecord>][])('renders no link when %s', (_label, overrides) => {
    renderHeader(overrides)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('translates the accessible name with the active locale', () => {
    useI18nStore.setState({ locale: 'es' })

    renderHeader()

    expect(
      screen.getByRole('link', {
        name: 'Abrir la ejecución de acme/shop en github.com (se abre en una pestaña nueva)',
      }),
    ).toBeInTheDocument()
  })

  it('is at least 44px tall below md and keeps a focus ring', () => {
    renderHeader()

    expect(screen.getByRole('link')).toHaveClass('min-h-11', 'focus-visible:outline-2')
  })
})
