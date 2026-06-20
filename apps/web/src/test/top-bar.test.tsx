import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TopBar } from '@/components/shell/top-bar'

const mockPathname = vi.fn(() => '/dashboard')
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}))

describe('TopBar', () => {
  it('shows "Dashboard" breadcrumb on /dashboard', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<TopBar />) })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('shows project + section breadcrumb inside a project', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<TopBar />) })
    expect(screen.getByText('Runs')).toBeInTheDocument()
  })

  it('has a search trigger button', async () => {
    await act(async () => { render(<TopBar />) })
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })

  it('shows user avatar', async () => {
    await act(async () => { render(<TopBar />) })
    expect(screen.getByText('IF')).toBeInTheDocument()
  })
})
