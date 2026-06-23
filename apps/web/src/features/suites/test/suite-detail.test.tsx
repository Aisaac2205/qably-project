import { render, screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SuiteDetail } from '@/features/suites/components/suite-detail'
import { __resetStore } from '@/lib/mock-store'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('SuiteDetail (redesigned)', () => {
  beforeEach(() => {
    __resetStore()
    mockPush.mockClear()
  })

  it('renders the suite name as h1', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByRole('heading', { level: 1, name: 'Authentication' })).toBeInTheDocument()
  })

  it('renders breadcrumbs with project + suites', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(within(nav).getByText('Projects')).toBeInTheDocument()
    expect(within(nav).getByText('Ecommerce App')).toBeInTheDocument()
    expect(within(nav).getByText('Suites')).toBeInTheDocument()
    expect(within(nav).getByText('Authentication')).toBeInTheDocument()
  })

  it('renders the description when present', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByText(/Login, registration, and password reset flows/)).toBeInTheDocument()
  })

  it('renders tags as Badge pills', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByText('auth')).toBeInTheDocument()
    expect(screen.getByText('security')).toBeInTheDocument()
  })

  it('shows default badge when isDefault is true', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByText('Default')).toBeInTheDocument()
  })

  it('renders a health strip with status, pass rate, last run, cases', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    const strip = screen.getByRole('group', { name: /Suite health/i })
    expect(within(strip).getByText(/Status/i)).toBeInTheDocument()
    expect(within(strip).getByText(/Pass rate/i)).toBeInTheDocument()
    expect(within(strip).getByText(/Last run/i)).toBeInTheDocument()
    expect(within(strip).getByText(/Cases/i)).toBeInTheDocument()
  })

  it('has a "Run this suite" button', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByRole('button', { name: /Run this suite/ })).toBeInTheDocument()
  })

  it('clicking "Run this suite" navigates to runs/new with suite query param', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    await user.click(screen.getByRole('button', { name: /Run this suite/ }))
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/runs/new?suite=suite-1')
  })

  it('renders the case list with a section heading', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByRole('heading', { level: 2, name: /Test cases/i })).toBeInTheDocument()
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
  })

  it('shows "Suite not found" with a back link for unknown id', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="nonexistent" />) })
    expect(screen.getByText('Suite not found')).toBeInTheDocument()
    const back = screen.getByRole('link', { name: /Back to project/i })
    expect(back.getAttribute('href')).toBe('/projects/proj-1')
  })
})
