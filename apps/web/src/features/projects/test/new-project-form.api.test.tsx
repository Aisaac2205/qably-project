import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NewProjectForm } from '@/features/projects/components/new-project-form'
import { createProject } from '@/features/projects/api/projects.api'
import {
  createConnection,
  detectStack,
  listAvailableRepos,
  listConnections,
} from '@/features/integrations/api/connections.api'
import { ApiError } from '@/lib/api-client'

const mockPush = vi.fn()
const mockBack = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

vi.mock('@/features/projects/api/projects.api', () => ({
  createProject: vi.fn(),
}))

vi.mock('@/features/integrations/api/connections.api', () => ({
  listConnections: vi.fn(),
  listAvailableRepos: vi.fn(),
  createConnection: vi.fn(),
  detectStack: vi.fn(),
}))

const create = vi.mocked(createProject)
const listConnectionsMock = vi.mocked(listConnections)
const listAvailableReposMock = vi.mocked(listAvailableRepos)
const createConnectionMock = vi.mocked(createConnection)
const detectStackMock = vi.mocked(detectStack)

const availableRepo = {
  id: '7',
  fullName: 'acme/checkout',
  isPrivate: true,
  defaultBranch: 'main',
}

const connection = {
  id: 'conn-1',
  organizationId: 'org-1',
  provider: 'GITHUB' as const,
  name: 'Primary',
  repo: 'acme/payments',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <NewProjectForm />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listConnectionsMock.mockResolvedValue([connection])
  listAvailableReposMock.mockResolvedValue([availableRepo])
  createConnectionMock.mockResolvedValue({ ...connection, id: 'conn-new' })
  detectStackMock.mockResolvedValue({ technologies: [] })
  create.mockResolvedValue({
    id: 'p1',
    name: 'Shop',
    organizationId: 'org-1',
    technologies: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
})

describe('NewProjectForm against the api', () => {
  it('sends the trimmed payload to the api on submit', async () => {
    const user = userEvent.setup()
    await act(async () => { renderForm() })

    await user.type(screen.getByLabelText(/Project name/), '  Shop  ')
    await user.click(screen.getByRole('button', { name: /Create project/ }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        name: 'Shop',
        description: undefined,
        connectionId: undefined,
        technologies: [],
      })
    })
  })

  it('navigates to the created project returned by the api', async () => {
    const user = userEvent.setup()
    await act(async () => { renderForm() })

    await user.type(screen.getByLabelText(/Project name/), 'Shop')
    await user.click(screen.getByRole('button', { name: /Create project/ }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/projects/p1'))
  })

  it('surfaces the api error message and stays on the form', async () => {
    create.mockRejectedValue(new ApiError(409, 'A project with that name already exists'))
    const user = userEvent.setup()
    await act(async () => { renderForm() })

    await user.type(screen.getByLabelText(/Project name/), 'Shop')
    await user.click(screen.getByRole('button', { name: /Create project/ }))

    expect(
      await screen.findByText('A project with that name already exists'),
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('offers a cancel action that leaves without creating anything', async () => {
    const user = userEvent.setup()
    await act(async () => { renderForm() })

    await user.click(screen.getByRole('button', { name: /Cancel/ }))

    expect(create).not.toHaveBeenCalled()
    expect(mockBack).toHaveBeenCalled()
  })

  it('keeps the cancel action reachable while the request is in flight', async () => {
    create.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    await act(async () => { renderForm() })

    await user.type(screen.getByLabelText(/Project name/), 'Shop')
    await user.click(screen.getByRole('button', { name: /Create project/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/ })).toBeEnabled()
    })
  })

  it('renders every field the api accepts', async () => {
    await act(async () => { renderForm() })

    expect(screen.getByLabelText(/Project name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
    expect(
      screen.getByRole('radiogroup', { name: /Repository connection/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create project/ })).toBeInTheDocument()
  })

  it('blocks the request when the name is empty', async () => {
    const user = userEvent.setup()
    await act(async () => { renderForm() })

    await user.click(screen.getByRole('button', { name: /Create project/ }))

    expect(screen.getByText('Project name is required')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('offers only the repositories already connected to the organization', async () => {
    await act(async () => { renderForm() })

    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /acme\/payments/ }),
      ).toBeInTheDocument()
    })
  })

  it('explains why no repository is selectable when github returns nothing', async () => {
    listConnectionsMock.mockResolvedValue([])
    listAvailableReposMock.mockResolvedValue([])
    await act(async () => { renderForm() })

    await waitFor(() => {
      expect(
        screen.getByText(/We found no repositories in your GitHub account/),
      ).toBeInTheDocument()
    })
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('sends the optional fields when they are filled in', async () => {
    const user = userEvent.setup()
    await act(async () => { renderForm() })

    await user.type(screen.getByLabelText(/Project name/), 'Payment Gateway')
    await user.type(screen.getByLabelText(/Description/), 'Checkout flows')
    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /acme\/payments/ }),
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('radio', { name: /acme\/payments/ }))
    await user.click(screen.getByRole('button', { name: /Create project/ }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        name: 'Payment Gateway',
        description: 'Checkout flows',
        connectionId: 'conn-1',
        technologies: [],
      })
    })
  })

  it('shows the pending label while the request is in flight', async () => {
    create.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    await act(async () => { renderForm() })

    await user.type(screen.getByLabelText(/Project name/), 'Shop')
    await user.click(screen.getByRole('button', { name: /Create project/ }))

    expect(
      await screen.findByRole('button', { name: /Creating/ }),
    ).toBeInTheDocument()
  })

  it('also offers github repositories that are not connected yet', async () => {
    await act(async () => { renderForm() })

    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /acme\/checkout/ }),
      ).toBeInTheDocument()
    })
  })

  it('does not offer a github repository that is already connected', async () => {
    listAvailableReposMock.mockResolvedValue([
      { ...availableRepo, fullName: 'acme/payments' },
    ])
    await act(async () => { renderForm() })

    await waitFor(() => {
      expect(screen.getAllByRole('radio')).toHaveLength(1)
    })
    expect(
      screen.getAllByRole('radio', { name: /acme\/payments/ }),
    ).toHaveLength(1)
  })

  it('connects a github repository before creating the project against it', async () => {
    const user = userEvent.setup()
    await act(async () => { renderForm() })

    await user.type(screen.getByLabelText(/Project name/), 'Checkout')
    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /acme\/checkout/ }),
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('radio', { name: /acme\/checkout/ }))
    await user.click(screen.getByRole('button', { name: /Create project/ }))

    await waitFor(() => {
      expect(createConnectionMock).toHaveBeenCalledWith({
        provider: 'GITHUB',
        name: 'acme/checkout',
        repo: 'acme/checkout',
      })
    })
    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: 'conn-new' }),
      )
    })
  })

  it('fills the stack from the package.json of the chosen repository', async () => {
    const user = userEvent.setup()
    detectStackMock.mockResolvedValue({ technologies: ['react', 'typescript'] })
    await act(async () => { renderForm() })

    await user.type(screen.getByLabelText(/Project name/), 'Checkout')
    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /acme\/checkout/ }),
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('radio', { name: /acme\/checkout/ }))

    await waitFor(() => {
      expect(detectStackMock).toHaveBeenCalledWith(
        'acme/checkout',
        expect.anything(),
      )
    })

    await user.click(screen.getByRole('button', { name: /Create project/ }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ technologies: ['react', 'typescript'] }),
      )
    })
  })

  it('does not ask github for a stack when no repository is chosen', async () => {
    await act(async () => { renderForm() })

    await waitFor(() => {
      expect(screen.getAllByRole('radio').length).toBeGreaterThan(0)
    })
    expect(detectStackMock).not.toHaveBeenCalled()
  })
})
