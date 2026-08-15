import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RepositoryPage from './page'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('RepositoryPage', () => {
  it('honestly describes the Phase 2 repository integration', async () => {
    await act(async () => { render(<RepositoryPage />) })
    expect(screen.getByRole('heading', { level: 1, name: 'Repository' })).toBeInTheDocument()
    expect(screen.getByText('Repository connections will be introduced for this project in Phase 2.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open integrations' })).toHaveAttribute('href', '/integrations')
  })
})
