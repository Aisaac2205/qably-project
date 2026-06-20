import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NewProjectForm } from '@/features/projects/components/new-project-form'
import { __resetStore, getProjects } from '@/lib/mock-store'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

describe('NewProjectForm', () => {
  beforeEach(() => {
    __resetStore()
    mockPush.mockClear()
  })

  it('renders form fields', async () => {
    await act(async () => { render(<NewProjectForm />) })
    expect(screen.getByLabelText(/Project name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
    expect(screen.getByLabelText(/GitHub repo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create project/ })).toBeInTheDocument()
  })

  it('shows error when name is empty on submit', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<NewProjectForm />) })
    await user.click(screen.getByRole('button', { name: /Create project/ }))
    expect(screen.getByText('Project name is required')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows error for invalid github repo format', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<NewProjectForm />) })
    await user.type(screen.getByLabelText(/Project name/), 'Test')
    await user.type(screen.getByLabelText(/GitHub repo/), 'not-a-valid-repo')
    await user.click(screen.getByRole('button', { name: /Create project/ }))
    expect(screen.getByText('Format must be org/repo')).toBeInTheDocument()
  })

  it('creates project and navigates on valid submit', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<NewProjectForm />) })

    const beforeCount = getProjects().length
    await user.type(screen.getByLabelText(/Project name/), 'Payment Gateway')
    await user.type(screen.getByLabelText(/Description/), 'Checkout flows')
    await user.type(screen.getByLabelText(/GitHub repo/), 'acme/payments')
    await user.click(screen.getByRole('button', { name: /Create project/ }))

    // Wait for the async submit
    await act(async () => { await new Promise((r) => setTimeout(r, 300)) })

    expect(getProjects().length).toBe(beforeCount + 1)
    const newProject = getProjects().find((p) => p.name === 'Payment Gateway')
    expect(newProject).toBeTruthy()
    expect(newProject?.id).toBe(`proj-${beforeCount + 1}`)
    expect(mockPush).toHaveBeenCalledWith(`/projects/${newProject?.id}`)
  })

  it('shows loading state during submit', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<NewProjectForm />) })
    await user.type(screen.getByLabelText(/Project name/), 'Payment Gateway')
    await user.click(screen.getByRole('button', { name: /Create project/ }))
    // Button text changes during loading
    expect(screen.getByRole('button')).toHaveTextContent('Creating…')
  })
})
