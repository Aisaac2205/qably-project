import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NewProjectForm } from '@/features/projects/components/new-project-form'
import { createProject } from '@/features/projects/api/projects.api'
import { ApiError } from '@/lib/api-client'

const mockPush = vi.fn()
const mockBack = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

vi.mock('@/features/projects/api/projects.api', () => ({
  createProject: vi.fn(),
}))

const create = vi.mocked(createProject)

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
        githubRepo: undefined,
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
    expect(screen.getByLabelText(/GitHub repo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create project/ })).toBeInTheDocument()
  })

  it('blocks the request when the name is empty', async () => {
    const user = userEvent.setup()
    await act(async () => { renderForm() })

    await user.click(screen.getByRole('button', { name: /Create project/ }))

    expect(screen.getByText('Project name is required')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('blocks the request when the repo is not in org/repo form', async () => {
    const user = userEvent.setup()
    await act(async () => { renderForm() })

    await user.type(screen.getByLabelText(/Project name/), 'Shop')
    await user.type(screen.getByLabelText(/GitHub repo/), 'not-a-valid-repo')
    await user.click(screen.getByRole('button', { name: /Create project/ }))

    expect(screen.getByText('Format must be org/repo')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('sends the optional fields when they are filled in', async () => {
    const user = userEvent.setup()
    await act(async () => { renderForm() })

    await user.type(screen.getByLabelText(/Project name/), 'Payment Gateway')
    await user.type(screen.getByLabelText(/Description/), 'Checkout flows')
    await user.type(screen.getByLabelText(/GitHub repo/), 'acme/payments')
    await user.click(screen.getByRole('button', { name: /Create project/ }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        name: 'Payment Gateway',
        description: 'Checkout flows',
        githubRepo: 'acme/payments',
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
})
