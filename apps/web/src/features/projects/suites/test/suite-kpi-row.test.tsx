import { screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SuiteKpiRow } from '@/features/projects/suites/components/suite-kpi-row'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery, withQueryClient } from '@/lib/query-test-utils'
import { useSuiteMetrics } from '@/features/projects/suites/hooks/use-suite-metrics'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

vi.mock('@/features/projects/suites/hooks/use-suite-metrics', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/projects/suites/hooks/use-suite-metrics')>()
  return { ...actual, useSuiteMetrics: vi.fn(actual.useSuiteMetrics) }
})

describe('SuiteKpiRow', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders 4 KPI labels', async () => {
    await act(async () => {
      renderWithQuery(<SuiteKpiRow projectId="proj-1" />)
    })
    expect(screen.getByText('Suites')).toBeInTheDocument()
    expect(screen.getByText('Test Cases')).toBeInTheDocument()
    expect(screen.getByText(/Pass Rate \(7d\)/)).toBeInTheDocument()
    expect(screen.getByText('Last Run')).toBeInTheDocument()
  })

  it('shows the right counts for a project with suites', async () => {
    await act(async () => {
      renderWithQuery(<SuiteKpiRow projectId="proj-1" />)
    })
    expect(screen.getAllByText('4').length).toBeGreaterThan(0)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('shows zeros for a project with no suites', async () => {
    await act(async () => {
      renderWithQuery(<SuiteKpiRow projectId="proj-empty" />)
    })
    // At least one "0" appears (Suites / Test Cases / Pass Rate)
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
    expect(screen.getByText('No suites yet')).toBeInTheDocument()
  })

  it('shows "—" for Last Run when no runs exist', async () => {
    await act(async () => {
      renderWithQuery(<SuiteKpiRow projectId="proj-empty" />)
    })
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('No runs yet')).toBeInTheDocument()
  })

  it('pass rate shows a percentage string', async () => {
    await act(async () => {
      renderWithQuery(<SuiteKpiRow projectId="proj-1" />)
    })
    // Some 7d pass rate is shown (mock data: suite-1 has 1 pass + 1 fail, suite-2 has 1 pass + 1 fail in window)
    const passRateEl = screen.getByText(/^\d+%/)
    expect(passRateEl).toBeInTheDocument()
  })

  it('groups KPIs in a grid', async () => {
    const { container } = renderWithQuery(<SuiteKpiRow projectId="proj-1" />)
    const grid = container.querySelector('[role="group"]')
    expect(grid).toBeInTheDocument()
    expect(grid?.className).toContain('grid-cols-2')
  })

  it('renders the fallback instead of throwing when lastRunAt is invalid', async () => {
    vi.mocked(useSuiteMetrics).mockReturnValueOnce({
      perSuite: [],
      projectMetrics: {
        totalSuites: 1,
        totalCases: 1,
        passRate7d: 0,
        lastRunAt: 'not-a-date',
      },
    })
    await act(async () => {
      renderWithQuery(<SuiteKpiRow projectId="proj-1" />)
    })
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
