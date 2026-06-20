import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SuiteRow } from '@/features/suites/components/suite-row'
import { __resetStore, updateSuite, getSuite } from '@/lib/mock-store'
import type { Suite } from '@qably/types'

// We need to mock the store's update function to verify it's called
vi.mock(import('@/lib/mock-store'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual }
})

const mockSuite: Suite = {
  id: 'suite-1',
  projectId: 'proj-1',
  organizationId: 'org-1',
  name: 'Authentication',
  cases: [
    {
      id: 'tc-1',
      suiteId: 'suite-1',
      name: 'Valid login',
      steps: ['Step 1'],
      expectedResult: 'Success',
      priority: 'critical',
      state: 'active',
    },
  ],
  createdAt: '2026-01-25T00:00:00Z',
}

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('SuiteRow', () => {
  it('renders suite name', async () => {
    await act(async () => { render(<SuiteRow suite={mockSuite} />) })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
  })

  it('shows case count', async () => {
    await act(async () => { render(<SuiteRow suite={mockSuite} />) })
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/cases/)).toBeInTheDocument()
  })

  it('shows creation date', async () => {
    await act(async () => { render(<SuiteRow suite={mockSuite} />) })
    // Date formatting is locale-dependent, just check it renders something non-empty
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('click name enters edit mode', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<SuiteRow suite={mockSuite} />) })
    await user.click(screen.getByText('Authentication'))
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('Authentication')
  })
})
