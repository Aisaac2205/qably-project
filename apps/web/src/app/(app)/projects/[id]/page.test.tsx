import { screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ProjectDetailPage from '@/app/(app)/projects/[id]/page'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

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


vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`)
  }),
}))

const params = Promise.resolve({ id: 'proj-1' })

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders the project home for an existing project', async () => {
    await act(async () => { renderWithQuery(<ProjectDetailPage params={params} />) })
    expect(screen.getByRole('heading', { level: 1, name: 'Ecommerce App' })).toBeInTheDocument()
  })

  it('shows "Project not found" for an unknown project', async () => {
    const badParams = Promise.resolve({ id: 'proj-nonexistent' })
    await act(async () => { renderWithQuery(<ProjectDetailPage params={badParams} />) })
    expect(screen.getByText('Project not found')).toBeInTheDocument()
  })

  it('renders breadcrumbs for the project', async () => {
    await act(async () => { renderWithQuery(<ProjectDetailPage params={params} />) })
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(nav).toBeInTheDocument()
  })

  it('renders the suite list for an existing project', async () => {
    await act(async () => { renderWithQuery(<ProjectDetailPage params={params} />) })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('Checkout')).toBeInTheDocument()
    expect(screen.getByText('User Account')).toBeInTheDocument()
  })
})
