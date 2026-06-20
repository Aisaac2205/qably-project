import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SuiteList } from '@/features/suites/components/suite-list'
import { __resetStore } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('SuiteList', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders suites for a project', async () => {
    await act(async () => { render(<SuiteList projectId="proj-1" />) })
    // proj-1 has 3 suites in mock data
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('Checkout')).toBeInTheDocument()
    expect(screen.getByText('User Account')).toBeInTheDocument()
  })

  it('sorts suites by createdAt descending', async () => {
    await act(async () => { render(<SuiteList projectId="proj-1" />) })
    const names = screen.getAllByText(/Authentication|Checkout|User Account/)
    // User Account has latest createdAt (2026-02-02)
    expect(names[0]).toHaveTextContent('User Account')
  })

  it('shows empty state for project with no suites', async () => {
    await act(async () => { render(<SuiteList projectId="proj-4" />) })
    expect(screen.getByText('No suites yet')).toBeInTheDocument()
  })
})
