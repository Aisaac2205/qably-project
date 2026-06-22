import { render, screen, act, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SuitesPage from '@/app/(app)/projects/[id]/suites/page'
import { __resetStore } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const params = Promise.resolve({ id: 'proj-1' })

describe('SuitesPage', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders the page title', async () => {
    await act(async () => {
      render(<SuitesPage params={params} />)
    })
    expect(screen.getByRole('heading', { level: 1, name: 'Suites' })).toBeInTheDocument()
  })

  it('renders breadcrumbs with the project name', async () => {
    await act(async () => {
      render(<SuitesPage params={params} />)
    })
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(nav).toBeInTheDocument()
    // proj-1 is "Ecommerce App"
    expect(within(nav).getByText('Ecommerce App')).toBeInTheDocument()
    expect(within(nav).getByText('Suites')).toBeInTheDocument()
    expect(within(nav).getByText('Projects')).toBeInTheDocument()
  })

  it('renders the project description as subtitle', async () => {
    await act(async () => {
      render(<SuitesPage params={params} />)
    })
    // proj-1 description: "Checkout, catalog, and user account flows."
    expect(screen.getByText(/Checkout, catalog/)).toBeInTheDocument()
  })

  it('renders the SuiteKpiRow with 4 KPI cards', async () => {
    await act(async () => {
      render(<SuitesPage params={params} />)
    })
    // "Suites" appears in: page h1, breadcrumb, and KPI label. Scope to the KPI group.
    const kpiGroup = screen.getByRole('group', { name: /Project suite health/i })
    expect(within(kpiGroup).getByText('Suites')).toBeInTheDocument()
    expect(within(kpiGroup).getByText('Test Cases')).toBeInTheDocument()
    expect(within(kpiGroup).getByText(/Pass Rate \(7d\)/)).toBeInTheDocument()
    expect(within(kpiGroup).getByText('Last Run')).toBeInTheDocument()
  })

  it('renders the SuiteList with seeded suites', async () => {
    await act(async () => {
      render(<SuitesPage params={params} />)
    })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('Checkout')).toBeInTheDocument()
    expect(screen.getByText('User Account')).toBeInTheDocument()
  })

  it('uses a constrained max-width container', async () => {
    const { container } = render(<SuitesPage params={params} />)
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('max-w-7xl')
  })
})

// (within is re-exported by @testing-library/react)
