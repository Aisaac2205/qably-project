import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SuiteRow, type SuiteRowData } from '@/features/projects/suites/components/suite-row'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'
import * as suitesApiStub from '@/test/suites-api-stub'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

const row: SuiteRowData = {
  id: 'suite-1',
  name: 'Authentication',
  description: 'Login flows for the Ecommerce App.',
  tags: ['auth', 'security'],
  isDefault: true,
  status: 'pass',
}

describe('SuiteRow (enriched)', () => {
  beforeEach(() => {
    __resetStore()
    vi.restoreAllMocks()
  })

  it('renders suite name', async () => {
    await act(async () => {
      renderWithQuery(<SuiteRow suite={row} />)
    })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
  })

  it('renders the description when present', async () => {
    await act(async () => {
      renderWithQuery(<SuiteRow suite={row} />)
    })
    expect(screen.getByText(/Login flows/)).toBeInTheDocument()
  })

  it('renders no description paragraph when the description is empty', async () => {
    await act(async () => {
      renderWithQuery(<SuiteRow suite={{ ...row, description: '' }} />)
    })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.queryByText(/Login flows/)).not.toBeInTheDocument()
  })

  it('renders tags as Badge pills', async () => {
    await act(async () => {
      renderWithQuery(<SuiteRow suite={row} />)
    })
    expect(screen.getByText('auth')).toBeInTheDocument()
    expect(screen.getByText('security')).toBeInTheDocument()
  })

  it('shows default star indicator when isDefault is true', async () => {
    await act(async () => {
      renderWithQuery(<SuiteRow suite={row} />)
    })
    expect(screen.getByText('Default suite')).toBeInTheDocument()
  })

  it('hides default star when isDefault is false', async () => {
    await act(async () => {
      renderWithQuery(<SuiteRow suite={{ ...row, isDefault: false }} />)
    })
    expect(screen.queryByText('Default suite')).not.toBeInTheDocument()
  })

  it('leaves the last run and its source mark to the detail page', async () => {
    const { container } = renderWithQuery(<SuiteRow suite={row} />)

    expect(screen.queryByText(/ago/i)).not.toBeInTheDocument()
    expect(container.querySelector('[aria-label="Manual"]')).toBeNull()
    expect(container.querySelector('[role="img"]')).toBeNull()
  })

  it('carries no case-composition icons, which navigate nowhere and repeat the detail page', async () => {
    const { container } = renderWithQuery(<SuiteRow suite={row} />)

    expect(container.querySelector('[role="img"][aria-label*="automated"]')).toBeNull()
    expect(container.querySelector('img[src="/logos/github.svg"]')).toBeNull()
  })

  it.each([
    ['pass', 'Pass'],
    ['fail', 'Fail'],
    ['running', 'Running'],
    ['needs-attention', 'Needs attention'],
    ['never-run', 'Never run'],
  ] as const)('renders the %s status chip with an icon and its text, never only a colour', async (status, label) => {
    await act(async () => {
      renderWithQuery(<SuiteRow suite={{ ...row, status }} />)
    })

    const chip = screen.getByText(label)
    expect(chip).toHaveAttribute('data-status', status)
    expect(chip.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })

  it('click name enters edit mode', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<SuiteRow suite={row} />)
    })
    await user.click(screen.getByText('Authentication'))
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('Authentication')
  })

  it('renames the suite with only the new name when the edit is committed', async () => {
    const user = userEvent.setup()
    const updateSuite = vi.spyOn(suitesApiStub, 'updateSuite')
    await act(async () => {
      renderWithQuery(<SuiteRow suite={row} />)
    })

    await user.click(screen.getByText('Authentication'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Sign in{Enter}')

    expect(updateSuite).toHaveBeenCalledTimes(1)
    expect(updateSuite).toHaveBeenCalledWith('suite-1', { name: 'Sign in' })
  })

  it('does not call the update when the committed name has not changed', async () => {
    const user = userEvent.setup()
    const updateSuite = vi.spyOn(suitesApiStub, 'updateSuite')
    await act(async () => {
      renderWithQuery(<SuiteRow suite={row} />)
    })

    await user.click(screen.getByText('Authentication'))
    await user.type(screen.getByRole('textbox'), '{Enter}')

    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(updateSuite).not.toHaveBeenCalled()
  })
})
