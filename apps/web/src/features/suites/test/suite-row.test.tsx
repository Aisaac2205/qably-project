import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SuiteRow } from '@/features/suites/components/suite-row'
import { __resetStore } from '@/lib/mock-store'
import { createMockSuite } from '@/lib/test-utils'
import { useSuiteMetrics } from '@/features/suites/hooks/use-suite-metrics'
import type { TestCase, Run } from '@qably/types'
import type { SuiteMetrics } from '@/features/suites/hooks/use-suite-metrics'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockCase: TestCase = {
  id: 'tc-1',
  suiteId: 'suite-1',
  name: 'Valid login',
  steps: ['Step 1'],
  expectedResult: 'Success',
  priority: 'critical',
  state: 'active',
}

const mockRun: Run = {
  id: 'run-99',
  projectId: 'proj-1',
  name: 'Run #99',
  suiteId: 'suite-1',
  suiteName: 'Authentication',
  cases: [],
  status: 'pass',
  passRate: 100,
  source: 'manual',
  startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  finishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
}

const mockMetrics: SuiteMetrics = {
  suite: {} as SuiteMetrics['suite'],
  lastRun: mockRun,
  passRate7d: 80,
  sparkline: [
    { date: '2026-06-10', passRate: 60, runCount: 1 },
    { date: '2026-06-11', passRate: 70, runCount: 1 },
    { date: '2026-06-12', passRate: 80, runCount: 1 },
    { date: '2026-06-13', passRate: 0, runCount: 0 },
    { date: '2026-06-14', passRate: 90, runCount: 1 },
    { date: '2026-06-15', passRate: 85, runCount: 1 },
    { date: '2026-06-16', passRate: 75, runCount: 1 },
  ],
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
      render(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
  })

  it('renders the description when present', async () => {
    await act(async () => {
      render(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    expect(screen.getByText(/Login flows/)).toBeInTheDocument()
  })

  it('renders tags as Badge pills', async () => {
    await act(async () => {
      render(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    expect(screen.getByText('auth')).toBeInTheDocument()
    expect(screen.getByText('security')).toBeInTheDocument()
  })

  it('shows default star indicator when isDefault is true', async () => {
    await act(async () => {
      render(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    // sr-only "Default suite" text
    expect(screen.getByText('Default suite')).toBeInTheDocument()
  })

  it('hides default star when isDefault is false', async () => {
    const nonDefault = createMockSuite({ ...mockSuite, isDefault: false })
    await act(async () => {
      render(<SuiteRow suite={nonDefault} metrics={metrics} />)
    })
    expect(screen.queryByText('Default suite')).not.toBeInTheDocument()
  })

  it('renders cases count', async () => {
    await act(async () => {
      render(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('case')).toBeInTheDocument()
  })

  it('renders last run reference with relative time', async () => {
    await act(async () => {
      render(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    // Should show "3 hours ago" or similar
    expect(screen.getByText(/ago/i)).toBeInTheDocument()
  })

  it('renders "Never" when no last run', async () => {
    const noRunMetrics = { ...metrics, lastRun: undefined }
    await act(async () => {
      render(<SuiteRow suite={mockSuite} metrics={noRunMetrics} />)
    })
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('renders the pass rate percentage', async () => {
    await act(async () => {
      render(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('renders a sparkline SVG with role="img"', async () => {
    const { container } = render(
      <SuiteRow suite={mockSuite} metrics={metrics} />,
    )
    expect(container.querySelector('svg[role="img"]')).toBeInTheDocument()
  })

  it('renders the status chip', async () => {
    await act(async () => {
      render(<SuiteRow suite={mockSuite} metrics={metrics} />)
    })
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('click name enters edit mode', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<SuiteRow suite={mockSuite} metrics={metrics} />)
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
