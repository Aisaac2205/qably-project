import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ApiKey } from '@qably/types'
import { ApiKeyList } from '../components/api-key-list'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const activeKey: ApiKey = {
  id: 'key-1',
  projectId: 'proj-1',
  name: 'CI/CD Pipeline',
  prefix: 'qbly_a1b2c3',
  lastFour: '9f2a',
  createdAt: '2026-06-01T10:00:00Z',
  lastUsedAt: '2026-06-15T08:30:00Z',
}

const revokedKey: ApiKey = {
  id: 'key-2',
  projectId: 'proj-1',
  name: 'Old staging key',
  prefix: 'qbly_g7h8i9',
  lastFour: '1e5d',
  createdAt: '2026-01-01T00:00:00Z',
  revokedAt: '2026-03-01T00:00:00Z',
}

describe('ApiKeyList', () => {
  it('shows a loading state', () => {
    render(
      <ApiKeyList
        apiKeys={[]}
        isLoading
        isError={false}
        projectId="proj-1"
        onCreateClick={vi.fn()}
        onRevoke={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error state', () => {
    render(
      <ApiKeyList
        apiKeys={[]}
        isLoading={false}
        isError
        projectId="proj-1"
        onCreateClick={vi.fn()}
        onRevoke={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText("Couldn't load the API keys.")).toBeInTheDocument()
  })

  it('shows an empty state that teaches what a key is for and links to Runs', () => {
    render(
      <ApiKeyList
        apiKeys={[]}
        isLoading={false}
        isError={false}
        projectId="proj-1"
        onCreateClick={vi.fn()}
        onRevoke={vi.fn()}
      />,
    )
    expect(screen.getByText('No API keys yet')).toBeInTheDocument()
    expect(screen.getByText(/GitHub Actions/)).toBeInTheDocument()
    const runsLink = screen.getByRole('link', { name: 'View runs' })
    expect(runsLink).toHaveAttribute('href', '/projects/proj-1/runs')
  })

  it('calls onCreateClick from the empty state action', async () => {
    const onCreateClick = vi.fn()
    render(
      <ApiKeyList
        apiKeys={[]}
        isLoading={false}
        isError={false}
        projectId="proj-1"
        onCreateClick={onCreateClick}
        onRevoke={vi.fn()}
      />,
    )
    screen.getByRole('button', { name: 'New key' }).click()
    expect(onCreateClick).toHaveBeenCalled()
  })

  it('renders active and revoked keys in visually distinct groups', () => {
    render(
      <ApiKeyList
        apiKeys={[activeKey, revokedKey]}
        isLoading={false}
        isError={false}
        projectId="proj-1"
        onCreateClick={vi.fn()}
        onRevoke={vi.fn()}
      />,
    )
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('CI/CD Pipeline')).toBeInTheDocument()
    expect(screen.getByText('Old staging key')).toBeInTheDocument()
    expect(screen.getAllByText('Revoked').length).toBeGreaterThan(0)
  })

  it('only shows a revoke button for active keys', () => {
    render(
      <ApiKeyList
        apiKeys={[activeKey, revokedKey]}
        isLoading={false}
        isError={false}
        projectId="proj-1"
        onCreateClick={vi.fn()}
        onRevoke={vi.fn()}
      />,
    )
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1)
  })

  it('calls onRevoke with the clicked key', () => {
    const onRevoke = vi.fn()
    render(
      <ApiKeyList
        apiKeys={[activeKey]}
        isLoading={false}
        isError={false}
        projectId="proj-1"
        onCreateClick={vi.fn()}
        onRevoke={onRevoke}
      />,
    )
    screen.getByRole('button', { name: 'Revoke' }).click()
    expect(onRevoke).toHaveBeenCalledWith(activeKey)
  })
})
