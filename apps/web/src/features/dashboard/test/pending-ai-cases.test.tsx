import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PendingProposals } from '@/features/dashboard/components/pending-ai-cases'
import { __resetStore } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('PendingProposals', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders pending proposals heading with count badge', async () => {
    await act(async () => {
      render(<PendingProposals />)
    })
    expect(screen.getByRole('heading', { name: /pending proposals/i })).toBeInTheDocument()
    expect(screen.getByText(/pending/)).toBeInTheDocument()
    expect(screen.getByText('Review inbox')).toBeInTheDocument()
  })

  it('shows pending proposals with titles and review CTA', async () => {
    await act(async () => {
      render(<PendingProposals />)
    })
    // Proposals are sorted by title; the first seed proposals include this one
    expect(screen.getByText('Invalid login shows error message')).toBeInTheDocument()
    const reviewButtons = screen.getAllByText('Review')
    expect(reviewButtons.length).toBeGreaterThan(0)
  })
})
