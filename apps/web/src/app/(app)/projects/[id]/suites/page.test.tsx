import { act, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SuitesPage from './page'
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
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('SuitesPage', () => {
  it('renders the project test library instead of redirecting to Overview', async () => {
    __resetStore()

    await act(async () => {
      renderWithQuery(<SuitesPage params={Promise.resolve({ id: 'proj-1' })} />)
    })

    expect(screen.getByRole('heading', { level: 1, name: 'Test Library' })).toBeInTheDocument()
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('Checkout')).toBeInTheDocument()
    expect(screen.getByText('User Account')).toBeInTheDocument()
  })
})
