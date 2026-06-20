import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from '@/components/shell/sidebar'

const mockPathname = vi.fn(() => '/dashboard')
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useParams: () => ({}),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('Sidebar — global state', () => {
  it('shows Dashboard and Projects links', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<Sidebar />) })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
  })

  it('does not show ← Projects in global state', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<Sidebar />) })
    expect(screen.queryByText(/← Projects/)).not.toBeInTheDocument()
  })
})

describe('Sidebar — project state', () => {
  it('shows ← Projects back link when inside a project', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<Sidebar />) })
    expect(screen.getByText(/← Projects/)).toBeInTheDocument()
  })

  it('shows project nav items when inside a project', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<Sidebar />) })
    expect(screen.getByText('Suites')).toBeInTheDocument()
    expect(screen.getByText('Runs')).toBeInTheDocument()
    expect(screen.getByText('AI Review')).toBeInTheDocument()
  })

  it('does not show global nav items when inside a project', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<Sidebar />) })
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })
})
