import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PendingAiCases } from '@/features/dashboard/components/pending-ai-cases'
import { __resetStore } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('PendingAiCases', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders pending AI proposals heading with count badge', async () => {
    await act(async () => {
      render(<PendingAiCases />)
    })
    expect(screen.getByRole('heading', { name: /pending ai cases/i })).toBeInTheDocument()
    expect(screen.getByText(/pending/)).toBeInTheDocument()
    expect(screen.getByText('Review inbox')).toBeInTheDocument()
  })

  it('shows pending AI proposals with source files and review CTA', async () => {
    await act(async () => {
      render(<PendingAiCases />)
    })
    expect(screen.getByText('Invalid login shows error message')).toBeInTheDocument()
    expect(screen.getByText('auth.spec.ts')).toBeInTheDocument()
    const reviewButtons = screen.getAllByText('Review')
    expect(reviewButtons.length).toBeGreaterThan(0)
  })
})
