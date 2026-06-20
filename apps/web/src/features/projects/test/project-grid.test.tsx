import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectGrid } from '@/features/projects/components/project-grid'
import { __resetStore } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('ProjectGrid', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders project cards for each project', async () => {
    await act(async () => { render(<ProjectGrid />) })
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
    expect(screen.getByText('Mobile App')).toBeInTheDocument()
    expect(screen.getByText('API Backend')).toBeInTheDocument()
    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
  })

  it('sorts projects by lastRunAt descending', async () => {
    await act(async () => { render(<ProjectGrid />) })
    const links = screen.getAllByRole('link')
    // API Backend has the most recent lastRunAt: 2026-06-16T10:15:00Z
    expect(links[0]).toHaveAttribute('href', '/projects/proj-3')
  })
})
