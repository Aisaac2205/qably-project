import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SuiteFiltersSheet } from '@/features/projects/suites/components/suite-filters-sheet'
import type { SuiteRunStatus } from '@qably/types'

const baseProps = {
  availableTags: ['smoke', 'auth'],
  status: 'all' as SuiteRunStatus | 'all',
  onStatusChange: vi.fn(),
  tag: 'all',
  onTagChange: vi.fn(),
  sort: 'recent' as const,
  onSortChange: vi.fn(),
}

describe('SuiteFiltersSheet', () => {
  it('renders a single trigger labelled with the filters copy', async () => {
    await act(async () => { render(<SuiteFiltersSheet {...baseProps} />) })

    expect(screen.getByTestId('suite-filters-trigger').textContent).toContain('Filters')
  })

  it('shows no active-count badge when nothing is filtered', async () => {
    await act(async () => { render(<SuiteFiltersSheet {...baseProps} />) })

    expect(screen.getByTestId('suite-filters-trigger').textContent).not.toMatch(/\d/)
  })

  it('counts status and tag as active filters, but not sort', async () => {
    await act(async () => {
      render(<SuiteFiltersSheet {...baseProps} status="fail" tag="smoke" sort="name" />)
    })

    expect(screen.getByTestId('suite-filters-trigger').textContent).toContain('2')
  })

  it('opens a panel with the three filter groups', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<SuiteFiltersSheet {...baseProps} />) })

    await user.click(screen.getByTestId('suite-filters-trigger'))

    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(screen.getByText('Sort by')).toBeInTheDocument()
  })

  it('opens full screen over an opaque background', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<SuiteFiltersSheet {...baseProps} />) })

    await user.click(screen.getByTestId('suite-filters-trigger'))

    const panel = screen.getByRole('dialog')
    expect(panel.className).toContain('bg-surface')
    expect(panel.className).toContain('data-[side=bottom]:inset-0')
    expect(panel.className).toContain('data-[side=bottom]:h-full')
    expect(panel.className).not.toContain('data-[side=bottom]:bottom-0')
    expect(panel.className).not.toContain('data-[side=bottom]:h-auto')
    expect(panel.className).not.toContain('bg-popover')
  })

  it('clears status and tag from the panel without touching sort', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()
    const onTagChange = vi.fn()
    const onSortChange = vi.fn()
    await act(async () => {
      render(
        <SuiteFiltersSheet
          {...baseProps}
          status="fail"
          tag="smoke"
          onStatusChange={onStatusChange}
          onTagChange={onTagChange}
          onSortChange={onSortChange}
        />,
      )
    })

    await user.click(screen.getByTestId('suite-filters-trigger'))
    await user.click(screen.getByRole('button', { name: /clear filters/i }))

    expect(onStatusChange).toHaveBeenCalledWith('all')
    expect(onTagChange).toHaveBeenCalledWith('all')
    expect(onSortChange).not.toHaveBeenCalled()
  })
})
