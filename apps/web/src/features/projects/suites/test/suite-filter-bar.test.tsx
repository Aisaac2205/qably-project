import { useState } from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SuiteFilterBar, type SortKey } from '@/features/projects/suites/components/suite-filter-bar'
import type { SuiteRunStatus } from '@qably/types'

const baseProps = {
  availableTags: ['smoke', 'auth', 'regression'],
  sort: 'recent' as SortKey,
  onSortChange: vi.fn(),
  status: 'all' as SuiteRunStatus | 'all',
  onStatusChange: vi.fn(),
  tag: 'all' as string,
  onTagChange: vi.fn(),
}

function ControlledHarness({ initial = '' }: { initial?: string }) {
  const [search, setSearch] = useState(initial)
  return (
    <SuiteFilterBar
      {...baseProps}
      search={search}
      onSearchChange={setSearch}
    />
  )
}

describe('SuiteFilterBar', () => {
  it('shows filter labels on the triggers, not the raw values', async () => {
    await act(async () => { render(<ControlledHarness />) })

    expect(screen.getByLabelText('Status filter').textContent).toContain('All statuses')
    expect(screen.getByLabelText('Tag filter').textContent).toContain('All tags')
    expect(screen.getByLabelText('Sort suites').textContent).toContain('Most recent')
  })

  it('never renders a bare option value on a trigger', async () => {
    await act(async () => { render(<ControlledHarness />) })

    for (const label of ['Status filter', 'Tag filter', 'Sort suites']) {
      expect(screen.getByLabelText(label).textContent?.trim()).not.toBe('all')
      expect(screen.getByLabelText(label).textContent?.trim()).not.toBe('recent')
    }
  })

  it('renders a search input with placeholder', async () => {
    await act(async () => {
      render(<ControlledHarness />)
    })
    expect(screen.getByPlaceholderText(/Search by name/i)).toBeInTheDocument()
  })

  it('renders 3 listbox triggers (status, tag, sort)', async () => {
    await act(async () => {
      render(<ControlledHarness />)
    })
    for (const name of [/status filter/i, /tag filter/i, /sort suites/i]) {
      const trigger = screen.getByRole('button', { name })
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    }
  })

  it('calls onSearchChange and updates the input when typing', async () => {
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    function Wrapper() {
      const [search, setSearch] = useState('')
      return (
        <SuiteFilterBar
          {...baseProps}
          search={search}
          onSearchChange={(v) => {
            onSearchChange(v)
            setSearch(v)
          }}
        />
      )
    }
    await act(async () => {
      render(<Wrapper />)
    })
    const input = screen.getByTestId('suite-search')
    await user.type(input, 'auth')
    expect(onSearchChange).toHaveBeenCalled()
    expect(onSearchChange).toHaveBeenLastCalledWith('auth')
    expect((input as HTMLInputElement).value).toBe('auth')
  })

  it('reflects the initial search value in the input', async () => {
    await act(async () => {
      render(<ControlledHarness initial="hello" />)
    })
    const input = screen.getByTestId('suite-search') as HTMLInputElement
    expect(input.value).toBe('hello')
  })

  it('exposes role="search" on the container', async () => {
    const { container } = render(<ControlledHarness />)
    expect(container.querySelector('[role="search"]')).toBeInTheDocument()
  })

  it('stacks on mobile and lays out in a row on desktop', async () => {
    const { container } = render(<ControlledHarness />)
    const root = container.querySelector('[role="search"]')
    expect(root?.className).toContain('flex-col')
    expect(root?.className).toContain('md:flex-row')
  })

  it('hides the three dropdowns below the md breakpoint', async () => {
    const { container } = render(<ControlledHarness />)
    const group = container.querySelector('[aria-label="Status filter"]')?.closest('div.hidden')
    expect(group?.className).toContain('md:flex')
  })
})
