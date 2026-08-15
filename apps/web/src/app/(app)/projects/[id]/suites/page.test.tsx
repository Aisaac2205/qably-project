import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SuitesPage from './page'
import { __resetStore } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('SuitesPage', () => {
  it('renders the project test library instead of redirecting to Overview', async () => {
    __resetStore()

    await act(async () => {
      render(<SuitesPage params={Promise.resolve({ id: 'proj-1' })} />)
    })

    expect(screen.getByRole('heading', { level: 1, name: 'Test Library' })).toBeInTheDocument()
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('Checkout')).toBeInTheDocument()
    expect(screen.getByText('User Account')).toBeInTheDocument()
  })
})
