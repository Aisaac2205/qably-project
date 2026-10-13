import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardOverviewRecord, DashboardPeriod } from '@qably/types'
import { dashboardOverviewFixture } from '@/test/dashboard-api-stub'
import type { StatisticsReport } from '@/features/statistics-pdf/lib/build-statistics-report'
import { DownloadStatisticsPdfButton } from '@/features/statistics-pdf/components/download-statistics-pdf-button'

const getDashboardOverview = vi.fn()
const renderStatisticsPdf = vi.fn()
const notifyError = vi.fn()

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardOverview: (...args: unknown[]) => getDashboardOverview(...args),
}))

// The renderer module is the dynamic-import boundary: mocking it keeps
// @react-pdf/renderer out of jsdom and lets the test drive its outcome.
vi.mock('@/features/statistics-pdf/lib/render-statistics-pdf', () => ({
  renderStatisticsPdf: (...args: unknown[]) => renderStatisticsPdf(...args),
}))

vi.mock('@/lib/notify', () => ({
  notify: { error: (...args: unknown[]) => notifyError(...args) },
}))

const createObjectURL = vi.fn(() => 'blob:qably-report')
const revokeObjectURL = vi.fn()
let downloads: { href: string; download: string }[] = []

function renderButton(props: { period?: DashboardPeriod; projectId?: string; projectName?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <DownloadStatisticsPdfButton period={props.period ?? 30} projectId={props.projectId} projectName={props.projectName} />
    </QueryClientProvider>,
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('DownloadStatisticsPdfButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    downloads = []
    getDashboardOverview.mockResolvedValue(dashboardOverviewFixture)
    renderStatisticsPdf.mockResolvedValue(new Blob(['%PDF-1.3'], { type: 'application/pdf' }))
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ href: this.href, download: this.download })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stays disabled until the statistics for the selected period have loaded', async () => {
    const pending = deferred<DashboardOverviewRecord>()
    getDashboardOverview.mockReturnValue(pending.promise)
    renderButton()

    const button = screen.getByRole('button', { name: 'Download PDF of the statistics for the last 30 days' })
    expect(button).toHaveAttribute('aria-disabled', 'true')

    pending.resolve(dashboardOverviewFixture)
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'))
  })

  it('stays disabled while the cached data still belongs to another period', async () => {
    getDashboardOverview.mockResolvedValue({ ...dashboardOverviewFixture, period: 7 })
    renderButton({ period: 30 })

    await waitFor(() => expect(getDashboardOverview).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /Download PDF/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('renders the selected period and downloads it under a descriptive file name', async () => {
    const user = userEvent.setup()
    renderButton({ period: 30 })

    const button = await screen.findByRole('button', { name: 'Download PDF of the statistics for the last 30 days' })
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'))
    await user.click(button)

    await waitFor(() => expect(downloads).toHaveLength(1))
    const report = renderStatisticsPdf.mock.calls[0]?.[0] as StatisticsReport
    expect(report.title).toBe('Qably — Quality statistics report')
    expect(report.meta[0]).toEqual({ label: 'Scope', value: 'All projects' })
    expect(report.projects).not.toBeNull()
    expect(downloads[0]?.href).toBe('blob:qably-report')
    expect(downloads[0]?.download).toMatch(/^qably-statistics-all-projects-30d-\d{4}-\d{2}-\d{2}\.pdf$/)
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:qably-report'))
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('scopes the report and the file name to the project', async () => {
    const user = userEvent.setup()
    renderButton({ period: 30, projectId: 'project-1', projectName: 'Checkout Web' })

    const button = await screen.findByRole('button', { name: /Download PDF/ })
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'))
    await user.click(button)

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(getDashboardOverview).toHaveBeenCalledWith(30, expect.any(String), 'project-1', expect.anything())
    const report = renderStatisticsPdf.mock.calls[0]?.[0] as StatisticsReport
    expect(report.meta[0]).toEqual({ label: 'Scope', value: 'Checkout Web' })
    expect(report.projects).toBeNull()
    expect(downloads[0]?.download).toMatch(/^qably-statistics-checkout-web-30d-/)
  })

  it('shows a busy state while the PDF is being generated', async () => {
    const user = userEvent.setup()
    const rendering = deferred<Blob>()
    renderStatisticsPdf.mockReturnValue(rendering.promise)
    renderButton()

    const button = await screen.findByRole('button', { name: /Download PDF/ })
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'))
    await user.click(button)

    const busy = await screen.findByRole('button', { name: 'Preparing PDF…' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(busy).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Preparing PDF…')

    await user.click(busy)
    expect(renderStatisticsPdf).toHaveBeenCalledTimes(1)

    rendering.resolve(new Blob(['%PDF'], { type: 'application/pdf' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Download PDF/ })).not.toHaveAttribute('aria-busy'),
    )
  })

  it('reports a failure with an error toast and recovers the button', async () => {
    const user = userEvent.setup()
    renderStatisticsPdf.mockRejectedValue(new Error('font failed to load'))
    renderButton()

    const button = await screen.findByRole('button', { name: /Download PDF/ })
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'))
    await user.click(button)

    await waitFor(() =>
      expect(notifyError).toHaveBeenCalledWith('The PDF could not be generated', {
        description: 'Your statistics were not changed. Try the download again.',
      }),
    )
    expect(downloads).toHaveLength(0)
    expect(screen.getByRole('button', { name: /Download PDF/ })).not.toHaveAttribute('aria-disabled', 'true')
  })
})
