import { render, screen, act, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SuiteDetail } from '@/features/projects/suites/components/suite-detail'
import { __resetStore } from '@/lib/mock-store'
import { createMockSuite, createMockTestCase } from '@/lib/test-utils'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import { notify } from '@/lib/notify'

import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

vi.mock('@/lib/notify', () => ({
  notify: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}))

import * as suitesApiStub from '@/test/suites-api-stub'

const mockPush = vi.fn()
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
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
    mockBack.mockClear()
    vi.mocked(notify.success).mockClear()
    vi.mocked(notify.info).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to the suites list when the back button is pressed with no prior history (e.g. a deep link)', async () => {
    const user = userEvent.setup()
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-4" />) })
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(mockBack).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/suites')
  })

  it('pushes to the Aeris chat with the case attached when Improve with Aeris is chosen', async () => {
    const user = userEvent.setup()
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })

    await user.click(screen.getAllByRole('button', { name: 'Case actions' })[0])
    await user.click(await screen.findByText('Improve with Aeris'))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringMatching(/^\/projects\/proj-1\/aeris\?case=tc-\d+$/),
    )
  })

  it('navigates to the previous history entry when the back button is pressed and history exists', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', window.location.href)
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-4" />) })
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
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

  it('renders nothing extra for a suite with an empty health summary', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })

    expect(screen.queryByRole('group', { name: /quality signals/i })).not.toBeInTheDocument()
  })

  it('renders a health signal chip per non-zero suite signal, with its count', async () => {
    vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValue(
      createMockSuite({
        id: 'suite-1',
        projectId: 'proj-1',
        healthSummary: { flaky: 2, 'raw-name': 1 },
      }),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    await act(async () => {
      render(
        <QueryClientProvider client={client}>
          <SuiteDetail projectId="proj-1" suiteId="suite-1" />
        </QueryClientProvider>,
      )
    })

    const strip = await screen.findByRole('group', { name: /quality signals/i })
    expect(within(strip).getByRole('button', { name: /flaky/i })).toHaveTextContent('2')
    expect(within(strip).getByRole('button', { name: /raw name/i })).toHaveTextContent('1')
  })

  it('omits a suite signal with a zero count from the strip', async () => {
    vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValue(
      createMockSuite({
        id: 'suite-1',
        projectId: 'proj-1',
        healthSummary: { flaky: 1 },
      }),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    await act(async () => {
      render(
        <QueryClientProvider client={client}>
          <SuiteDetail projectId="proj-1" suiteId="suite-1" />
        </QueryClientProvider>,
      )
    })

    const strip = await screen.findByRole('group', { name: /quality signals/i })
    expect(within(strip).queryByRole('button', { name: /never run/i })).not.toBeInTheDocument()
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

  it('keeps the default badge from shrinking beside a long suite name', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    const badge = screen.getByText('Default').closest('span')
    expect(badge?.className).toContain('shrink-0')
    expect(badge?.className).toContain('whitespace-nowrap')
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
      undocumentedCount: 0,
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
    expect(screen.queryByText(/all cases in this suite run in ci/i)).not.toBeInTheDocument()
  })

  it('asks for one confirmation while Aeris-documented drafts remain in the suite', async () => {
    const documentedSuite = createMockSuite({
      id: 'suite-documented',
      name: 'Documented',
      manualCases: 0,
      automatedCases: 2,
      undocumentedCount: 0,
      cases: [
        createMockTestCase({
          id: 'tc-doc-1',
          executionMode: 'automated',
          state: 'draft',
          steps: ['Open the cart', 'Pay'],
          expectedResult: 'The order is created',
        }),
        createMockTestCase({
          id: 'tc-doc-2',
          executionMode: 'automated',
          state: 'active',
          steps: ['Log in'],
          expectedResult: 'The dashboard opens',
        }),
      ],
    })
    vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValue(documentedSuite)

    renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-documented" />)
    await act(async () => {})
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

    expect(
      screen.getByRole('button', { name: /confirm 1 case$/i }),
    ).toBeInTheDocument()
  })

  it('does not ask for confirmation when no documented draft is left', async () => {
    const confirmedSuite = createMockSuite({
      id: 'suite-confirmed',
      name: 'Confirmed',
      manualCases: 0,
      automatedCases: 1,
      undocumentedCount: 0,
      cases: [
        createMockTestCase({
          id: 'tc-done-1',
          executionMode: 'automated',
          state: 'active',
          steps: ['Log in'],
          expectedResult: 'The dashboard opens',
        }),
      ],
    })
    vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValue(confirmedSuite)

    renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-confirmed" />)
    await act(async () => {})
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

    expect(
      screen.queryByRole('button', { name: /confirm \d+ case/i }),
    ).not.toBeInTheDocument()
  })

  it('renders the Aeris action as the primary control when the suite is fully automated', async () => {
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

    const aerisButton = screen.getByRole('button', { name: /document \(1\)/i })
    expect(aerisButton.className).not.toContain('border-dashed')
    expect(screen.getByRole('button', { name: /suite actions/i })).toBeInTheDocument()
  })

  it('shows only the undocumented-cases hint, not the CI-only explanation, when the suite has both', async () => {
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

    expect(screen.getByRole('button', { name: /document \(1\)/i })).toBeInTheDocument()
    expect(screen.queryByText(/all cases in this suite run in ci/i)).not.toBeInTheDocument()
  })

  describe('Aeris action label switching', () => {
    function automatedIncompleteSuite(overrides: Partial<Parameters<typeof createMockSuite>[0]> = {}) {
      return createMockSuite({
        id: 'suite-incomplete',
        name: 'Incomplete',
        manualCases: 0,
        automatedCases: 1,
        undocumentedCount: 0,
        incompleteCount: 1,
        cases: [
          createMockTestCase({
            id: 'tc-incomplete-1',
            executionMode: 'automated',
            state: 'active',
            steps: ['open'],
            expectedResult: 'done',
          }),
        ],
        ...overrides,
      })
    }

    it('switches to the completion label and mode once no case is undocumented but some remain incomplete', async () => {
      vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValue(automatedIncompleteSuite())

      renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-incomplete" />)
      await act(async () => {})
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

      expect(screen.getByRole('button', { name: /complete \(1\)/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^document \(\d+\)$/i })).not.toBeInTheDocument()
    })

    it('sends the incomplete mode when the completion action is triggered', async () => {
      const user = userEvent.setup()
      const documentSuiteSpy = vi.spyOn(suitesApiStub, 'documentSuite')
      vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValue(automatedIncompleteSuite())

      renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-incomplete" />)
      await act(async () => {})
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

      await user.click(screen.getByRole('button', { name: /complete \(1\)/i }))

      await vi.waitFor(() => {
        expect(documentSuiteSpy).toHaveBeenCalledWith('suite-incomplete', 'incomplete')
      })
    })

    it('counts the suite itself when its own documentation is incomplete, even with no incomplete cases', async () => {
      vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValue(
        automatedIncompleteSuite({
          incompleteCount: 0,
          documentation: {
            outcome: 'skipped',
            missing: ['tags'],
            skipReason: 'already-pending',
            queuedAt: null,
            outcomeAt: '2026-03-01T00:00:00Z',
          },
        }),
      )

      renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-incomplete" />)
      await act(async () => {})
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

      expect(screen.getByRole('button', { name: /complete \(1\)/i })).toBeInTheDocument()
    })

    it('hides the Aeris action once nothing is undocumented, incomplete, or stale', async () => {
      vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValue(
        automatedIncompleteSuite({ incompleteCount: 0 }),
      )

      renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-incomplete" />)
      await act(async () => {})
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

      expect(screen.queryByRole('button', { name: /document|complete/i })).not.toBeInTheDocument()
    })
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

  it('navigates to the suite edit page instead of opening a modal', async () => {
    const user = userEvent.setup()
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })

    await user.click(screen.getByRole('button', { name: /suite actions/i }))
    await user.click(await screen.findByText('Edit suite'))

    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/suites/suite-1/edit')
  })

  it('the "Add case" button is a link to the suite edit page with a new case preselected', async () => {
    await act(async () => { renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })

    expect(screen.getByRole('link', { name: /add case/i })).toHaveAttribute(
      'href',
      '/projects/proj-1/suites/suite-1/edit?case=new',
    )
  })

  describe('case list grouping', () => {
    function documentedCase(id: string) {
      return createMockTestCase({
        id,
        executionMode: 'automated',
        state: 'active',
        steps: ['Log in'],
        expectedResult: 'The dashboard opens',
      })
    }

    function undocumentedCase(id: string) {
      return createMockTestCase({ id, executionMode: 'automated', state: 'draft' })
    }

    it('renders a short mixed suite flat, with no group headers', async () => {
      const shortSuite = createMockSuite({
        id: 'suite-short-mixed',
        manualCases: 0,
        automatedCases: 3,
        undocumentedCount: 1,
        cases: [documentedCase('c1'), documentedCase('c2'), undocumentedCase('c3')],
      })
      vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValueOnce(shortSuite)

      renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-short-mixed" />)
      await act(async () => {})
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

      expect(screen.queryByText('Needs attention')).not.toBeInTheDocument()
      expect(screen.queryByText('Documented')).not.toBeInTheDocument()
    })

    it('groups a large, fully documented suite under a single "Documented" header', async () => {
      const cases = Array.from({ length: 9 }, (_, i) => documentedCase(`c${i}`))
      const bigDocumentedSuite = createMockSuite({
        id: 'suite-big-documented',
        manualCases: 0,
        automatedCases: 9,
        undocumentedCount: 0,
        cases,
      })
      vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValueOnce(bigDocumentedSuite)

      renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-big-documented" />)
      await act(async () => {})
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

      expect(screen.queryByText('Needs attention')).not.toBeInTheDocument()
      const heading = screen.getByText('Documented')
      expect(heading).toBeInTheDocument()
      expect(within(heading.parentElement as HTMLElement).getByText('9')).toBeInTheDocument()
    })

    it('splits a large mixed suite into needs-attention and documented groups', async () => {
      const cases = [
        ...Array.from({ length: 7 }, (_, i) => documentedCase(`d${i}`)),
        undocumentedCase('u1'),
        undocumentedCase('u2'),
      ]
      const bigMixedSuite = createMockSuite({
        id: 'suite-big-mixed',
        manualCases: 0,
        automatedCases: 9,
        undocumentedCount: 2,
        cases,
      })
      vi.spyOn(suitesApiStub, 'getSuite').mockResolvedValueOnce(bigMixedSuite)

      renderWithQuery(<SuiteDetail projectId="proj-1" suiteId="suite-big-mixed" />)
      await act(async () => {})
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

      const attentionHeading = screen.getByText('Needs attention')
      const documentedHeading = screen.getByText('Documented')
      expect(within(attentionHeading.parentElement as HTMLElement).getByText('2')).toBeInTheDocument()
      expect(within(documentedHeading.parentElement as HTMLElement).getByText('7')).toBeInTheDocument()
      expect(
        attentionHeading.compareDocumentPosition(documentedHeading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })
  })

  describe('Aeris documentation watch', () => {
    const watchSuiteId = 'suite-watch'

    it('announces the run as queued, then settles with the real count once a later poll confirms it', async () => {
      const user = userEvent.setup()

      const initialSuite = createMockSuite({
        id: watchSuiteId,
        name: 'Watched',
        manualCases: 0,
        automatedCases: 1,
        undocumentedCount: 1,
        cases: [
          createMockTestCase({ id: 'tc-watch-1', executionMode: 'automated', state: 'draft' }),
        ],
      })

      const staleSuite = createMockSuite({
        id: watchSuiteId,
        name: 'Watched',
        manualCases: 0,
        automatedCases: 1,
        undocumentedCount: 1,
        cases: [
          createMockTestCase({ id: 'tc-watch-1', executionMode: 'automated', state: 'draft' }),
        ],
      })

      const busySuite = createMockSuite({
        id: watchSuiteId,
        name: 'Watched',
        manualCases: 0,
        automatedCases: 1,
        undocumentedCount: 1,
        cases: [
          createMockTestCase({
            id: 'tc-watch-1',
            executionMode: 'automated',
            state: 'draft',
            documentation: {
              outcome: null,
              missing: [],
              skipReason: null,
              queuedAt: '2026-06-01T00:00:00Z',
              outcomeAt: null,
            },
          }),
        ],
      })

      const settledSuite = createMockSuite({
        id: watchSuiteId,
        name: 'Watched',
        manualCases: 0,
        automatedCases: 1,
        undocumentedCount: 0,
        cases: [
          createMockTestCase({
            id: 'tc-watch-1',
            executionMode: 'automated',
            state: 'active',
            steps: ['Log in'],
            expectedResult: 'The dashboard opens',
            documentation: {
              outcome: 'complete',
              missing: [],
              skipReason: null,
              queuedAt: '2026-06-01T00:00:00Z',
              outcomeAt: '2026-06-01T00:05:00Z',
            },
          }),
        ],
      })

      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: Infinity, refetchOnMount: false },
          mutations: { retry: false },
        },
      })
      client.setQueryData(suiteKeys.detail(watchSuiteId), initialSuite)

      vi.spyOn(suitesApiStub, 'getSuite')
        .mockResolvedValueOnce(staleSuite)
        .mockResolvedValueOnce(busySuite)
        .mockResolvedValue(settledSuite)
      vi.spyOn(suitesApiStub, 'documentSuite').mockResolvedValue({
        filesEnqueued: 1,
        casesTargeted: 1,
        casesSkipped: [],
      })

      await act(async () => {
        render(
          <QueryClientProvider client={client}>
            <SuiteDetail projectId="proj-1" suiteId={watchSuiteId} />
          </QueryClientProvider>,
        )
      })

      await user.click(screen.getByRole('button', { name: /document \(1\)/i }))

      await waitFor(() => {
        expect(notify.info).toHaveBeenCalledWith(
          'Aeris is documenting 1 cases across 1 files.',
          undefined,
        )
      })
      expect(suitesApiStub.getSuite).toHaveBeenCalledTimes(1)
      expect(notify.success).not.toHaveBeenCalled()

      await act(async () => {
        await client.refetchQueries({ queryKey: suiteKeys.detail(watchSuiteId) })
      })
      expect(notify.success).not.toHaveBeenCalled()

      await act(async () => {
        await client.refetchQueries({ queryKey: suiteKeys.detail(watchSuiteId) })
      })

      await waitFor(() => {
        expect(notify.success).toHaveBeenCalledWith('Aeris documented 1 case in this suite.')
      })

      const infoOrder = vi.mocked(notify.info).mock.invocationCallOrder[0]
      const successOrder = vi.mocked(notify.success).mock.invocationCallOrder[0]
      expect(infoOrder).toBeLessThan(successOrder)
    })
  })
})
