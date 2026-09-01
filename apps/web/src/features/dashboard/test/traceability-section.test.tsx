import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TraceabilitySection } from '@/features/dashboard/components/traceability-section'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'

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
  })

  it('renders the traceability calendar header and clean toolbar', async () => {
    await act(async () => {
      renderWithQuery(<TraceabilitySection />)
    })

    expect(
      screen.getByRole('heading', { name: 'Governance pipeline' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Live traceability across repositories/i),
    ).toBeInTheDocument()
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
})
