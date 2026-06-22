import { useState } from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SuiteFilterBar, type SortKey } from '@/features/suites/components/suite-filter-bar'
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
  it('renders a search input with placeholder', async () => {
    await act(async () => {
      render(<ControlledHarness />)
    })
    expect(screen.getByPlaceholderText(/Search by name/i)).toBeInTheDocument()
  })

  it('renders 3 selects (status, tag, sort)', async () => {
    await act(async () => {
      render(<ControlledHarness />)
    })
    expect(screen.getByRole('combobox', { name: /status filter/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /tag filter/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /sort suites/i })).toBeInTheDocument()
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

  it('uses a 2-column grid on mobile and flex on desktop', async () => {
    const { container } = render(<ControlledHarness />)
    const root = container.querySelector('[role="search"]')
    expect(root?.className).toContain('grid-cols-2')
    expect(root?.className).toContain('md:flex')
  })
})
