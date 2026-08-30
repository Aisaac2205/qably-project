import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AppShell } from '@/components/shell/app-shell'

vi.mock('@/features/projects/hooks/use-project', async () => {
  const { getProject } = await import('@/lib/mock-store')
  return {
    useProject: (id: string) => ({
      project: getProject(id),
      isLoading: false,
      isError: false,
    }),
  }
})


vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
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

  it('keeps shell chrome flat and frames only the central workspace', async () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    )

    expect(container.querySelector('[data-slot="sidebar"]')).toHaveAttribute('data-variant', 'sidebar')
    expect(container.querySelector('[data-slot="sidebar-wrapper"]')).toHaveClass('bg-sidebar')
    expect(container.querySelector('[data-slot="sidebar-inset"]')).toHaveClass('bg-sidebar')
    expect(screen.getByRole('main')).toHaveClass(
      'bg-surface',
      'overflow-auto',
      'md:m-3',
      'md:mt-0',
      'md:rounded-2xl',
      'md:ring-1',
    )
  })

  it('starts keyboard order with a visible-on-focus skip link and one main landmark', async () => {
    const user = userEvent.setup()
    render(<AppShell><p>Content</p></AppShell>)

    await user.tab()

    const skipLink = screen.getByRole('link', { name: 'Skip to main content' })
    expect(skipLink).toHaveFocus()
    expect(skipLink).toHaveAttribute('href', '#main-content')
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })

  it('focuses main content when the skip link is activated by keyboard', async () => {
    const user = userEvent.setup()
    render(<AppShell><p>Content</p></AppShell>)

    await user.tab()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('main')).toHaveFocus()
  })
})
