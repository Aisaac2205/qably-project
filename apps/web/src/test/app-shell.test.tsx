import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AppShell } from '@/components/shell/app-shell'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

describe('AppShell', () => {
  it('renders children', async () => {
    await act(async () => {
      render(
        <AppShell>
          <div data-testid="content">Content</div>
        </AppShell>
      )
    })
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })

  it('renders sidebar', async () => {
    await act(async () => {
      render(
        <AppShell>
          <div>Content</div>
        </AppShell>
      )
    })
    expect(screen.getByRole('navigation', { name: /sidebar/i })).toBeInTheDocument()
  })

  it('renders top bar', async () => {
    await act(async () => {
      render(
        <AppShell>
          <div>Content</div>
        </AppShell>
      )
    })
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })
})
