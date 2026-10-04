import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RunListPageClient } from './client'
import { renderWithQuery } from '@/lib/query-test-utils'
import { listCiRuns } from '@/features/runs/api/ci-runs.api'
import { expectFocusRing } from '@/features/runs/test/focus-ring'
import * as useProjectModule from '@/features/projects/hooks/use-project'

vi.mock('@/features/runs/api/runs.api', async () => await import('@/test/runs-api-stub'))
vi.mock('@/features/runs/api/ci-runs.api', () => ({
  listCiRuns: vi.fn(),
  getCiRun: vi.fn(),
}))

function stubProject(overrides: Partial<ReturnType<typeof useProjectModule.useProject>> = {}) {
  vi.spyOn(useProjectModule, 'useProject').mockReturnValue({
    project: {
      id: 'proj-1',
      name: 'Ecommerce App',
      organizationId: 'org-1',
      technologies: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      hasManualCases: true,
    },
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useProjectModule.useProject>)
}

function stubProjectWith(hasManualCases: boolean | undefined) {
  stubProject({
    project: {
      id: 'proj-1',
      name: 'Ecommerce App',
      organizationId: 'org-1',
      technologies: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      hasManualCases,
    },
  })
}

describe('RunListPageClient', () => {
  beforeEach(() => {
    vi.mocked(listCiRuns).mockResolvedValue({ items: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an enabled New run link when the project has manual cases', () => {
    stubProject({ project: { id: 'proj-1', name: 'Ecommerce App', organizationId: 'org-1', technologies: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', hasManualCases: true } })

    renderWithQuery(<RunListPageClient projectId="proj-1" initialTab="manual" />)

    const link = screen.getByRole('link', { name: /new run/i })
    expect(link).toHaveAttribute('href', '/projects/proj-1/runs/new')
  })

  it('disables New run and shows a hint when the project has no manual cases', () => {
    stubProject({ project: { id: 'proj-1', name: 'Ecommerce App', organizationId: 'org-1', technologies: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', hasManualCases: false } })

    renderWithQuery(<RunListPageClient projectId="proj-1" initialTab="manual" />)

    const button = screen.getByRole('button', { name: /new run/i })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('link', { name: /new run/i })).not.toBeInTheDocument()
    expect(screen.getByText(/automated cases are fed by ci/i)).toBeInTheDocument()
  })

  describe('the new run action', () => {
    it('is absent while the Actions tab is open', () => {
      stubProjectWith(true)

      renderWithQuery(<RunListPageClient projectId="proj-1" initialTab="actions" />)

      expect(screen.queryByRole('link', { name: /new run/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /new run/i })).not.toBeInTheDocument()
    })

    it('is absent from the Actions tab when the project has no manual cases either', () => {
      stubProjectWith(false)

      renderWithQuery(<RunListPageClient projectId="proj-1" initialTab="actions" />)

      expect(screen.queryByRole('button', { name: /new run/i })).not.toBeInTheDocument()
      expect(screen.queryByText(/automated cases are fed by ci/i)).not.toBeInTheDocument()
    })

    it.each<[string, boolean | undefined]>([
      ['has manual cases', true],
      ['has not reported whether it has manual cases', undefined],
    ])('is a link with the default button height when the project %s', (_label, hasManualCases) => {
      stubProjectWith(hasManualCases)

      renderWithQuery(<RunListPageClient projectId="proj-1" initialTab="manual" />)

      const link = screen.getByRole('link', { name: /new run/i })
      expect(link).toHaveAttribute('href', '/projects/proj-1/runs/new')
      expect(link).toHaveClass('h-11', 'md:h-10')
      expect(screen.queryByRole('button', { name: /new run/i })).not.toBeInTheDocument()
    })

    it('is a disabled button that still takes focus and is described by the hint when there are no manual cases', async () => {
      const user = userEvent.setup()
      stubProjectWith(false)

      renderWithQuery(<RunListPageClient projectId="proj-1" initialTab="manual" />)

      const button = screen.getByRole('button', { name: /new run/i })
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).not.toHaveAttribute('disabled')
      expect(button).toHaveAccessibleDescription(
        'Automated cases are fed by CI; add a manual case to a suite to run it here.',
      )
      expect(button).toHaveClass('h-11', 'md:h-10')
      expect(screen.queryByRole('link', { name: /new run/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Manual' }))
      await user.tab()
      expect(button).toHaveFocus()
    })

    it('appears and disappears with the tab that is open', async () => {
      const user = userEvent.setup()
      stubProjectWith(true)
      renderWithQuery(<RunListPageClient projectId="proj-1" />)
      expect(screen.queryByRole('link', { name: /new run/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Manual' }))
      expect(screen.getByRole('link', { name: /new run/i })).toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Actions' }))
      expect(screen.queryByRole('link', { name: /new run/i })).not.toBeInTheDocument()
    })

    it('is the first stop after the tabs when the Manual tab is open', async () => {
      const user = userEvent.setup()
      stubProjectWith(true)
      renderWithQuery(<RunListPageClient projectId="proj-1" initialTab="manual" />)
      screen.getByRole('tab', { name: 'Manual' }).focus()

      await user.tab()

      expect(screen.getByRole('link', { name: /new run/i })).toHaveFocus()
    })

    it('carries a visible focus ring as a link and as a disabled button', () => {
      stubProjectWith(true)
      const asLink = renderWithQuery(<RunListPageClient projectId="proj-1" initialTab="manual" />)
      expectFocusRing(screen.getByRole('link', { name: /new run/i }))
      asLink.unmount()

      stubProjectWith(false)
      renderWithQuery(<RunListPageClient projectId="proj-1" initialTab="manual" />)
      expectFocusRing(screen.getByRole('button', { name: /new run/i }))
    })
  })

  describe('the page chrome', () => {
    it('does not render the retired subtitle in either tab', () => {
      stubProjectWith(true)

      const first = renderWithQuery(<RunListPageClient projectId="proj-1" initialTab="actions" />)
      expect(screen.queryByText(/Each run is evidence of what happened once/)).not.toBeInTheDocument()
      first.unmount()

      renderWithQuery(<RunListPageClient projectId="proj-1" initialTab="manual" />)
      expect(screen.queryByText(/Each run is evidence of what happened once/)).not.toBeInTheDocument()
    })

    it.each<['actions' | 'manual']>([['actions'], ['manual']])(
      'has one screen-reader h1 and no page header with the %s tab open',
      (initialTab) => {
        stubProjectWith(true)

        const { container } = renderWithQuery(
          <RunListPageClient projectId="proj-1" initialTab={initialTab} />,
        )

        const headings = screen.getAllByRole('heading', { level: 1 })
        expect(headings).toHaveLength(1)
        expect(headings[0]).toHaveTextContent('Runs')
        expect(headings[0]).toHaveClass('sr-only')
        expect(container.querySelector('header')).toBeNull()
      },
    )
  })
})
