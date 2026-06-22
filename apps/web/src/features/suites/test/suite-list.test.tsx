import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SuiteList } from '@/features/suites/components/suite-list'
import { __resetStore } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

function SuiteListForTest() {
  return <SuiteList projectId="proj-1" />
}

describe('SuiteList', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders the filter bar and the 3 seeded suites', async () => {
    await act(async () => {
      render(<SuiteListForTest />)
    })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('Checkout')).toBeInTheDocument()
    expect(screen.getByText('User Account')).toBeInTheDocument()
  })

  it('shows "No suites yet" empty state for a project with no suites', async () => {
    await act(async () => {
      render(<SuiteList projectId="proj-empty" />)
    })
    expect(screen.getByText('No suites yet')).toBeInTheDocument()
  })

  it('shows "No matches" empty state when filter excludes everything', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<SuiteListForTest />)
    })
    const input = screen.getByTestId('suite-search')
    await user.type(input, 'xyz-no-match')
    expect(screen.getByText(/No suites match your filters/)).toBeInTheDocument()
  })

  it('shows "Clear filters" button when filter is active', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<SuiteListForTest />)
    })
    const input = screen.getByTestId('suite-search')
    await user.type(input, 'xyz')
    const clearBtn = screen.getByText('Clear filters')
    expect(clearBtn).toBeInTheDocument()
  })

  it('clears filters when "Clear filters" is clicked', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<SuiteListForTest />)
    })
    const input = screen.getByTestId('suite-search') as HTMLInputElement
    await user.type(input, 'xyz')
    expect(input.value).toBe('xyz')
    const clearBtn = screen.getByText('Clear filters')
    await user.click(clearBtn)
    expect(input.value).toBe('')
    // All 3 suites should be back
    expect(screen.getByText('Authentication')).toBeInTheDocument()
  })

  it('filters by search (case-insensitive)', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<SuiteListForTest />)
    })
    const input = screen.getByTestId('suite-search')
    await user.type(input, 'CHECKOUT')
    expect(screen.getByText('Checkout')).toBeInTheDocument()
    expect(screen.queryByText('Authentication')).not.toBeInTheDocument()
    expect(screen.queryByText('User Account')).not.toBeInTheDocument()
  })

  it('search matches description text too', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<SuiteListForTest />)
    })
    const input = screen.getByTestId('suite-search')
    // "Cart, payment" is in the description of suite-2 (Checkout)
    await user.type(input, 'cart')
    expect(screen.getByText('Checkout')).toBeInTheDocument()
  })

  it('suite rows link to suite detail', async () => {
    await act(async () => {
      render(<SuiteListForTest />)
    })
    const link = screen.getByText('Authentication').closest('a')
    expect(link?.getAttribute('href')).toBe('/projects/proj-1/suites/suite-1')
  })
})
