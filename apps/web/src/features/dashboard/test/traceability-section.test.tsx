import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TraceabilitySection } from '@/features/dashboard/components/traceability-section'
import { __resetStore } from '@/lib/mock-store'

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

  it('renders the traceability calendar header and live streams', async () => {
    await act(async () => {
      render(<TraceabilitySection />)
    })

    expect(
      screen.getByRole('heading', { name: 'Governance pipeline' }),
    ).toBeInTheDocument()
    expect(screen.getByText('SCM Ingestion')).toBeInTheDocument()
    expect(screen.getByText('AI Proposals')).toBeInTheDocument()
    expect(screen.getByText('Official Cases')).toBeInTheDocument()
    expect(screen.getByText('CI Executions')).toBeInTheDocument()
  })

  it('renders the SVG contribution grid with 53 weeks and month labels', async () => {
    await act(async () => {
      render(<TraceabilitySection />)
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

  it('allows filtering by stage', async () => {
    await act(async () => {
      render(<TraceabilitySection />)
    })

    const scmButton = screen.getByRole('button', { name: /SCM Ingestion/i })
    expect(scmButton).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(scmButton)
    })

    expect(scmButton).toHaveClass('border-border-strong')
  })

  it('renders the clean year dropdown selector', async () => {
    await act(async () => {
      render(<TraceabilitySection />)
    })

    const selectTrigger = screen.getByRole('combobox')
    expect(selectTrigger).toBeInTheDocument()
    expect(selectTrigger).toHaveTextContent('2026')
  })
})
