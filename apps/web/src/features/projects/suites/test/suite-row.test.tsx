import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SuiteRow } from '@/features/projects/suites/components/suite-row'
import { __resetStore } from '@/lib/mock-store'
import { createMockSuite } from '@/lib/test-utils'
import { useSuiteMetrics } from '@/features/projects/suites/hooks/use-suite-metrics'
import type { TestCase, RunSummaryRecord, RunStatus } from '@qably/types'
import type { SuiteMetrics } from '@/features/projects/suites/hooks/use-suite-metrics'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockCase: TestCase = {
  id: 'tc-1',
  suiteId: 'suite-1',
  version: 1,
  name: 'Valid login',
  objective: '',
  preconditions: [],
  steps: ['Step 1'],
  expectedResult: 'Success',
  priority: 'critical',
  state: 'active',
  executionMode: 'manual',
}

const mockRun: RunSummaryRecord = {
  id: 'run-99',
  projectId: 'proj-1',
  organizationId: 'org-1',
  name: 'Run #99',
  suiteId: 'suite-1',
  suiteName: 'Authentication',
  status: 'pass',
  source: 'manual',
  externalId: '',
  reportExternalId: '',
  startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  finishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  caseCounts: { total: 1, pending: 0, running: 0, pass: 1, fail: 0, skip: 0, blocked: 0 },
  passRate: 1,
  delta: null,
}

const mockMetrics: SuiteMetrics = {
  suite: {} as SuiteMetrics['suite'],
  lastRun: mockRun,
  recentPassRate: 80,
  history: ['fail', 'pass', 'pass', 'pass', 'pass'] as RunStatus[],
  status: 'pass',
}

const mockSuite = createMockSuite({
  id: 'suite-1',
  name: 'Authentication',
  description: 'Login flows for the Ecommerce App.',
  cases: [mockCase],
  tags: ['auth', 'security'],
  isDefault: true,
})

// Replace the metrics arg in the test
const metrics = { ...mockMetrics, suite: mockSuite }

describe('SuiteRow (enriched)', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders suite name', async () => {
    await act(async () => {
      renderWithQuery(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
  })

  it('renders the description when present', async () => {
    await act(async () => {
      renderWithQuery(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    expect(screen.getByText(/Login flows/)).toBeInTheDocument()
  })

  it('renders tags as Badge pills', async () => {
    await act(async () => {
      renderWithQuery(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    expect(screen.getByText('auth')).toBeInTheDocument()
    expect(screen.getByText('security')).toBeInTheDocument()
  })

  it('shows default star indicator when isDefault is true', async () => {
    await act(async () => {
      renderWithQuery(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    // sr-only "Default suite" text
    expect(screen.getByText('Default suite')).toBeInTheDocument()
  })

  it('hides default star when isDefault is false', async () => {
    const nonDefault = createMockSuite({ ...mockSuite, isDefault: false })
    await act(async () => {
      renderWithQuery(<SuiteRow suite={nonDefault} metrics={metrics} />)
    })
    expect(screen.queryByText('Default suite')).not.toBeInTheDocument()
  })

  it('leaves the last run, its source mark and the pass rate to the detail page', async () => {
    const { container } = renderWithQuery(<SuiteRow suite={mockSuite} metrics={metrics} />)

    expect(screen.queryByText(/ago/i)).not.toBeInTheDocument()
    expect(screen.queryByText('80%')).not.toBeInTheDocument()
    expect(container.querySelector('[aria-label="Manual"]')).toBeNull()
    expect(container.querySelector('[role="img"]')).toBeNull()
  })

  it('renders the status chip', async () => {
    await act(async () => {
      renderWithQuery(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('carries no case-composition icons, which navigate nowhere and repeat the detail page', async () => {
    const mixedSuite = createMockSuite({
      ...mockSuite,
      manualCases: 2,
      automatedCases: 3,
    })
    const { container } = renderWithQuery(
      <SuiteRow suite={mixedSuite} metrics={{ ...metrics, suite: mixedSuite }} />,
    )
    expect(container.querySelector('[role="img"][aria-label*="automated"]')).toBeNull()
    expect(container.querySelector('img[src="/logos/github.svg"]')).toBeNull()
  })

  it('click name enters edit mode', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    await user.click(screen.getByText('Authentication'))
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('Authentication')
  })
})

// Sanity: ensure the hook import doesn't crash the file
it('useSuiteMetrics is importable', () => {
  expect(typeof useSuiteMetrics).toBe('function')
})
