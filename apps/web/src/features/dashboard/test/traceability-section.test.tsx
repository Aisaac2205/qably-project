import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TraceabilitySection } from '@/features/dashboard/components/traceability-section'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'
import { useI18nStore } from '@/lib/i18n'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

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

  it('renders the SVG contribution grid with 53 weeks and month labels', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    const svg = screen.getByRole('img', {
      name: /Calendario de trazabilidad y gobernanza de 2026/i,
    })
    expect(svg).toBeInTheDocument()

    // Day labels
    expect(screen.getByText(/Mon|Lun/)).toBeInTheDocument()
    expect(screen.getByText(/Wed|Mié/)).toBeInTheDocument()
    expect(screen.getByText(/Fri|Vie/)).toBeInTheDocument()
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
})
