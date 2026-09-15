import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { TraceabilitySection } from '@/features/dashboard/components/traceability-section'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery, createTestQueryClient } from '@/lib/query-test-utils'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { useI18nStore } from '@/lib/i18n'
import { traceabilityCalendarFixture } from '@/test/dashboard-api-stub'
import { getTraceabilityCalendar } from '@/features/dashboard/api/dashboard.api'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardSummary: vi.fn(),
  getTraceabilityCalendar: vi.fn(),
}))

const getTraceability = vi.mocked(getTraceabilityCalendar)

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [k: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('TraceabilitySection (Contribution Calendar)', () => {
  beforeEach(() => {
    __resetStore()
    useI18nStore.setState({ locale: 'en' })
    getTraceability.mockResolvedValue(traceabilityCalendarFixture)
  })

  it('summarises the year in a single heading line', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    const heading = screen.getByRole('heading', { name: /traceability events in 2026/i })

    expect(heading).toBeInTheDocument()
    expect(heading.textContent).toMatch(/^[0-9,]+ /)
  })

  it('drops the subtitle and the duplicated review inbox link from the header', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    expect(
      screen.queryByText(/Live traceability across repositories/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Review inbox/i })).not.toBeInTheDocument()
  })

  it('exposes the calendar as a table labelled in the active locale', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    const year = new Date().getFullYear()
    expect(
      screen.getByRole('grid', { name: new RegExp(`${year} traceability calendar`, 'i') }),
    ).toBeInTheDocument()
  })

  it('gives every weekday a row header, not only the three it shows', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    expect(screen.getAllByRole('rowheader')).toHaveLength(7)
  })

  it('renders clean dropdown selectors for stage filtering and year in the header', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    const comboboxes = screen.getAllByRole('combobox')
    expect(comboboxes.length).toBe(2)

    // Stage selector showing active label with total
    expect(comboboxes[0]).toHaveTextContent(/All stages|Todas las etapas/i)

    // Year selector
    expect(comboboxes[1]).toHaveTextContent('2026')
  })

  it('keeps the stage-select trigger icon-free, GitHub-style plain text controls', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    const [stageTrigger] = screen.getAllByRole('combobox')
    expect(stageTrigger.querySelectorAll('svg')).toHaveLength(1)
  })

  it('keeps the header filters visually quiet so they never outweigh the heading', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    const [stageTrigger, yearTrigger] = screen.getAllByRole('combobox')
    expect(stageTrigger).toHaveClass('border-transparent')
    expect(yearTrigger).toHaveClass('border-transparent')
    expect(yearTrigger).toHaveClass('font-medium')
    expect(yearTrigger).not.toHaveClass('font-semibold')
  })

  it('states the yearly total once instead of repeating it in the stage selector', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    const heading = screen.getByRole('heading', { name: /traceability events in 2026/i })
    const total = heading.textContent?.match(/^[\d.,]+/)?.[0]
    expect(total).toBeTruthy()

    const [stageTrigger] = screen.getAllByRole('combobox')
    expect(stageTrigger.textContent).not.toContain(total)
  })

  it('groups the per-stage counts with the separator of the active locale', async () => {
    useI18nStore.setState({ locale: 'es' })
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    const heading = screen.getByRole('heading', { name: /eventos de trazabilidad en 2026/i })
    expect(heading.textContent).toMatch(/^\d{1,3}(\.\d{3})*\s/)
  })

  it('reports the total the traceability endpoint returned, not a generated one', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    const { totals } = traceabilityCalendarFixture
    const expected = totals.scm + totals.proposals + totals.official + totals.runs

    const heading = screen.getByRole('heading', { name: /traceability events in/i })
    expect(heading.textContent).toContain(String(expected))
  })

  it('offers the current year rather than a year frozen in mock data', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    const [, yearTrigger] = screen.getAllByRole('combobox')
    expect(yearTrigger).toHaveTextContent(String(new Date().getFullYear()))
  })

  it('declares its own container context on the card surface, without the legacy shadow', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    const region = screen.getByRole('region', { name: /traceability events in/i })
    expect(region).toHaveClass('@container')
    expect(region.className).not.toContain('shadow-xs')
  })

  it('shows a skeleton in the body while the calendar loads, keeping the header visible', async () => {
    getTraceability.mockReturnValue(new Promise(() => {}))
    const client = createTestQueryClient()
    const year = new Date().getFullYear()
    client.removeQueries({ queryKey: dashboardKeys.traceability(year, 'all') })

    const { container } = render(
      <QueryClientProvider client={client}>
        <TraceabilitySection />
      </QueryClientProvider>,
    )

    expect(screen.getAllByRole('combobox').length).toBe(2)
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it('shows one error state with a retry action wired to the traceability query when it fails', async () => {
    getTraceability.mockRejectedValue(new Error('network down'))
    const client = createTestQueryClient()
    const year = new Date().getFullYear()
    client.removeQueries({ queryKey: dashboardKeys.traceability(year, 'all') })

    render(
      <QueryClientProvider client={client}>
        <TraceabilitySection />
      </QueryClientProvider>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()

    getTraceability.mockResolvedValueOnce(traceabilityCalendarFixture)
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    await act(async () => {
      retryButton.click()
    })

    await waitFor(() => expect(screen.getByRole('grid')).toBeInTheDocument())
  })
})
