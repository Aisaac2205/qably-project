import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Project, RepoConnection } from '@qably/types'
import { EditProjectDialog } from '@/features/projects/components/edit-project-dialog'
import {
  listConnections,
  rotateConnectionWebhookSecret,
} from '@/features/integrations/api/connections.api'

vi.mock('@/features/integrations/api/connections.api', () => ({
  listConnections: vi.fn(),
  rotateConnectionWebhookSecret: vi.fn(),
}))

vi.mock('@/features/projects/hooks/use-update-project', () => ({
  useUpdateProject: () => ({ update: vi.fn() }),
}))

const listConnectionsMock = vi.mocked(listConnections)
const rotateMock = vi.mocked(rotateConnectionWebhookSecret)

const connection: RepoConnection = {
  id: 'conn-1',
  organizationId: 'org-1',
  provider: 'GITHUB',
  name: 'Primary',
  repo: 'acme/payments',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const project: Project = {
  id: 'proj-1',
  name: 'Payments',
  description: 'Checkout flows',
  connectionId: 'conn-1',
  organizationId: 'org-1',
  technologies: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <EditProjectDialog project={project} open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listConnectionsMock.mockResolvedValue([connection])
  rotateMock.mockResolvedValue({ webhookSecret: 'b'.repeat(64) })
})

describe('EditProjectDialog webhook setup', () => {
  it('offers to view the webhook setup for the connected repository', async () => {
    renderDialog()

    expect(
      await screen.findByRole('button', { name: 'View webhook setup' }),
    ).toBeInTheDocument()
  })

  it('shows the payload URL and steps without a secret, since none can be recovered', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(await screen.findByRole('button', { name: 'View webhook setup' }))

    expect(screen.getByText(/webhooks\/scm\/github/)).toBeInTheDocument()
    expect(screen.getByText(/shown only once, when this repository was connected/i)).toBeInTheDocument()
  })

  it('warns before regenerating the secret', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(await screen.findByRole('button', { name: 'View webhook setup' }))
    await user.click(screen.getByRole('button', { name: 'Regenerate secret' }))

    expect(screen.getByText(/stops being valid immediately/i)).toBeInTheDocument()
    expect(rotateMock).not.toHaveBeenCalled()
  })

  it('regenerates and reveals the new secret once confirmed', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(await screen.findByRole('button', { name: 'View webhook setup' }))
    await user.click(screen.getByRole('button', { name: 'Regenerate secret' }))
    await user.click(screen.getByRole('button', { name: 'Regenerate secret' }))

    await waitFor(() => {
      expect(rotateMock).toHaveBeenCalledWith('conn-1')
    })
    expect(await screen.findByText('b'.repeat(64))).toBeInTheDocument()
  })

  it('reports a regeneration failure without revealing a secret', async () => {
    const user = userEvent.setup()
    rotateMock.mockRejectedValue(new Error('nope'))
    renderDialog()

    await user.click(await screen.findByRole('button', { name: 'View webhook setup' }))
    await user.click(screen.getByRole('button', { name: 'Regenerate secret' }))
    await user.click(screen.getByRole('button', { name: 'Regenerate secret' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The secret could not be regenerated. Try again.',
    )
  })

  it('does not offer webhook setup when no repository is connected', async () => {
    listConnectionsMock.mockResolvedValue([])
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditProjectDialog
          project={{ ...project, connectionId: undefined }}
          open
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'View webhook setup' })).not.toBeInTheDocument()
    })
  })
})
