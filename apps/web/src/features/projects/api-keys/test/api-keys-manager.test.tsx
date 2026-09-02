import { screen, act, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiKeysManager } from '@/features/projects/api-keys/components/api-keys-manager'
import { renderWithQuery } from '@/lib/query-test-utils'
import { __resetApiKeysStub } from '@/test/api-keys-api-stub'

vi.mock('@/features/projects/api-keys/api/api-keys.api', async () =>
  await import('@/test/api-keys-api-stub'),
)

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('ApiKeysManager', () => {
  beforeEach(() => {
    __resetApiKeysStub()
  })

  it('renders active and revoked keys distinctly for the project', async () => {
    await act(async () => {
      renderWithQuery(<ApiKeysManager projectId="proj-1" />)
    })

    await waitFor(() => {
      expect(screen.getByText('CI/CD Pipeline')).toBeInTheDocument()
    })
    expect(screen.getByText('Nightly regression')).toBeInTheDocument()
    expect(screen.getByText('Old staging key')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(2)
  })

  it('surfaces the token exactly once on creation, then it is gone after dismissing', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<ApiKeysManager projectId="proj-1" />)
    })
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'New key' }).length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByRole('button', { name: 'New key' })[0])
    await user.type(screen.getByLabelText('Key name'), 'Fresh pipeline key')
    await user.click(screen.getByRole('button', { name: 'Create key' }))

    await waitFor(() => {
      expect(screen.getByText('qbly_newkey_supersecrettokenvalue')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => {
      expect(screen.queryByText('qbly_newkey_supersecrettokenvalue')).not.toBeInTheDocument()
    })
  })

  it('requires confirmation before revoking and calls the revoke endpoint', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<ApiKeysManager projectId="proj-1" />)
    })
    await waitFor(() => {
      expect(screen.getByText('CI/CD Pipeline')).toBeInTheDocument()
    })

    const [revokeButton] = screen.getAllByRole('button', { name: 'Revoke' })
    await user.click(revokeButton)

    const dialogTitle = await screen.findByText('Revoke “CI/CD Pipeline”?')
    expect(dialogTitle).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(screen.queryByText('Revoke “CI/CD Pipeline”?')).not.toBeInTheDocument()
    })
  })
})
