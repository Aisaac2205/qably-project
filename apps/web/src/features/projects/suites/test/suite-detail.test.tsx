import { screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SuiteDetail } from '@/features/projects/suites/components/suite-detail'
import { __resetStore } from '@/lib/mock-store'
import { createMockSuite, createMockTestCase } from '@/lib/test-utils'

import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

import * as suitesApiStub from '@/test/suites-api-stub'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))
vi.mock('@/features/projects/hooks/use-project', () => ({
  useProject: () => ({
    project: { id: 'proj-1', name: 'Ecommerce App' },
    isLoading: false,
    isError: false,
  }),
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

  it('disables the run button on a suite with no cases, while keeping it focusable', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-4" />) })

    expect(screen.getByText(/no test cases in this suite yet/i)).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /run this suite/i })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('tabindex', '0')
  })

  it('renders the empty-suite run button with the disabled-looking class contract', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-4" />) })

    const button = screen.getByRole('button', { name: /run this suite/i })
    expect(button.className).toContain('aria-disabled:opacity-50')
    expect(button.className).toContain('aria-disabled:pointer-events-none')
  })

  it('explains the disabled run button with a visible hint linked via aria-describedby', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-4" />) })

    const button = screen.getByRole('button', { name: /run this suite/i })
    const describedBy = button.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()

    const hint = document.getElementById(describedBy as string)
    expect(hint).not.toBeNull()
    expect(hint).toHaveTextContent(/add at least one test case/i)
  })

  it('enables the run button when the suite has cases', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })

    expect(screen.getByRole('button', { name: /run this suite/i })).toBeEnabled()
  })

  it('renders the suite name as h1', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByRole('heading', { level: 1, name: 'Authentication' })).toBeInTheDocument()
  })

  it('renders breadcrumbs with project + suites', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(within(nav).getByText('Projects')).toBeInTheDocument()
    expect(within(nav).getByText('Ecommerce App')).toBeInTheDocument()
    expect(within(nav).getByText('Suites')).toBeInTheDocument()
    expect(within(nav).getByText('Authentication')).toBeInTheDocument()
  })

  it('renders the description when present', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByText(/Login, registration, and password reset flows/)).toBeInTheDocument()
  })

  it('renders tags as Badge pills', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByText('auth')).toBeInTheDocument()
    expect(screen.getByText('security')).toBeInTheDocument()
  })

  it('shows default badge when isDefault is true', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByText('Default')).toBeInTheDocument()
  })

  it('renders a health strip with status, pass rate, last run, cases', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    const strip = screen.getByRole('group', { name: /Suite health/i })
    expect(within(strip).getByText(/Status/i)).toBeInTheDocument()
    expect(within(strip).getByText(/Pass rate/i)).toBeInTheDocument()
    expect(within(strip).getByText(/Last run/i)).toBeInTheDocument()
    expect(within(strip).getByText(/Cases/i)).toBeInTheDocument()
  })

  it('has a "Run this suite" button', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByRole('button', { name: /Run this suite/ })).toBeInTheDocument()
  })

  it('clicking "Run this suite" navigates to runs/new with suite query param', async () => {
    const user = userEvent.setup()
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    await user.click(screen.getByRole('button', { name: /Run this suite/ }))
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/runs/new?suite=suite-1')
  })

  it('renders the case list with a section heading', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByRole('heading', { level: 2, name: /Test cases/i })).toBeInTheDocument()
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
  })

  it('hides the version badge for an unpublished case with a null version', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    const caseCard = screen.getByText('Reset password flow').closest('.group')
    expect(caseCard).not.toBeNull()
    expect(within(caseCard as HTMLElement).queryByText('v1')).not.toBeInTheDocument()
  })

  it('shows the loading state before the suite query settles', async () => {
    renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="nonexistent" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading suites…')).toBeInTheDocument()
    expect(screen.queryByText('Suite not found')).not.toBeInTheDocument()

    await act(async () => {})
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  })

  it('shows "Suite not found" with a back link for unknown id', async () => {
    renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="nonexistent" />)
    await act(async () => {})
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(screen.getByText('Suite not found')).toBeInTheDocument()
    const back = screen.getByRole('link', { name: /Back to project/i })
    expect(back.getAttribute('href')).toBe('/projects/proj-1/repository')
  })

  it('points the project breadcrumb at the canonical project root', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(within(nav).getByText('Ecommerce App').closest('a')).toHaveAttribute(
      'href',
      '/projects/proj-1/repository',
    )
  })

  it('points the Suites breadcrumb at the test library, not the project root', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(within(nav).getByText('Suites').closest('a')).toHaveAttribute(
      'href',
      '/projects/proj-1/suites',
    )
  })

  it('hides "Run this suite" and shows an inline note when the suite has no manual cases but has automated ones', async () => {
    const ciOnlySuite = createMockSuite({
      id: 'suite-ci-only',
      name: 'CI Only',
      manualCases: 0,
      automatedCases: 1,
      cases: [
        createMockTestCase({
          id: 'tc-ci-1',
          executionMode: 'automated',
          name: 'Redirects to dashboard on valid login',
          automationKey: 'useCreateRun > redirects to dashboard on valid login',
          state: 'active',
        }),
      ],
    })
    vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValueOnce(ciOnlySuite)

    renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-ci-only" />)
    await act(async () => {})
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

    expect(screen.queryByRole('button', { name: /run this suite/i })).not.toBeInTheDocument()
    expect(screen.getByText(/all cases in this suite run in ci/i)).toBeInTheDocument()
  })

  it('lists automated cases with their last result under "Covered by CI"', async () => {
    const mixedSuite = createMockSuite({
      id: 'suite-mixed',
      name: 'Mixed',
      manualCases: 1,
      automatedCases: 1,
      cases: [
        createMockTestCase({ id: 'tc-manual-1', executionMode: 'manual', name: 'Manual case' }),
        createMockTestCase({
          id: 'tc-auto-1',
          executionMode: 'automated',
          name: 'Redirects to dashboard on valid login',
          automationKey: 'useCreateRun > redirects to dashboard on valid login',
          state: 'active',
          lastResult: {
            status: 'pass',
            runId: 'run-1',
            commitSha: 'abc1234',
            recordedAt: '2026-06-16T10:00:00Z',
          },
        }),
      ],
    })
    vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValueOnce(mixedSuite)

    renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-mixed" />)
    await act(async () => {})
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

    expect(screen.getByRole('button', { name: /run this suite/i })).toBeInTheDocument()
    const heading = screen.getByRole('heading', { level: 2, name: /covered by ci/i })
    expect(heading).toBeInTheDocument()
    const section = heading.closest('section')
    expect(section).not.toBeNull()
    expect(
      within(section as HTMLElement).getByText('Redirects to dashboard on valid login'),
    ).toBeInTheDocument()
  })

  it('returns to the test library after deleting the suite', async () => {
    const user = userEvent.setup()
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })

    await user.click(screen.getByRole('button', { name: /suite actions/i }))
    await user.click(await screen.findByText('Delete suite'))
    await user.click(await screen.findByRole('button', { name: /^delete$/i }))

    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/suites')
    })
  })
})
