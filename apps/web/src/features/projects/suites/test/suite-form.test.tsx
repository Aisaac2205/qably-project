import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Suite } from '@qably/types'
import { SuiteForm } from '@/features/projects/suites/components/suite-form'
import { renderWithQuery } from '@/lib/query-test-utils'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/features/projects/suites/api/suites.api', async () => {
  const stub = await import('@/test/suites-api-stub')
  return { ...stub, updateSuite: vi.fn(stub.updateSuite), createSuite: vi.fn(stub.createSuite) }
})

const suite: Suite = {
  id: 'suite-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  name: 'Checkout',
  description: 'Covers checkout',
  tags: ['auth', 'payments'],
  cases: [],
  manualCases: 0,
  automatedCases: 0,
  undocumentedCount: 0,
  staleLocaleCount: 0,
  isDefault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('SuiteForm', () => {
  beforeEach(async () => {
    const { __resetSuitesStub } = await import('@/test/suites-api-stub')
    __resetSuitesStub()
    vi.clearAllMocks()
  })

  it('shows the create title and button when no suite is passed', async () => {
    await renderWithQuery(<SuiteForm projectId="project-1" />)
    expect(screen.getByRole('heading', { name: 'New suite' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create suite' })).toBeInTheDocument()
  })

  it('shows the edit title and button when a suite is passed', async () => {
    await renderWithQuery(<SuiteForm projectId="project-1" suite={suite} />)
    expect(screen.getByRole('heading', { name: 'Edit suite' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('prefills name, description and tags in edit mode', async () => {
    await renderWithQuery(<SuiteForm projectId="project-1" suite={suite} />)
    expect(screen.getByLabelText('Name')).toHaveValue('Checkout')
    expect(screen.getByLabelText('Description')).toHaveValue('Covers checkout')
    expect(screen.getByLabelText('Tags')).toHaveValue('auth, payments')
  })

  it('requires a name on submit', async () => {
    const user = userEvent.setup()
    await renderWithQuery(<SuiteForm projectId="project-1" />)
    await user.click(screen.getByRole('button', { name: 'Create suite' }))
    expect(screen.getByText('A suite name is required')).toBeInTheDocument()
  })

  it('creates a suite and navigates to its detail page', async () => {
    const user = userEvent.setup()
    await renderWithQuery(<SuiteForm projectId="project-1" />)
    await user.type(screen.getByLabelText('Name'), 'Payments')
    await user.click(screen.getByRole('button', { name: 'Create suite' }))
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/projects\/project-1\/suites\/.+/))
    })
  })

  it('sends only the description when only the description changed, then navigates back to the suite', async () => {
    const user = userEvent.setup()
    const { updateSuite } = await import('@/features/projects/suites/api/suites.api')
    const spy = updateSuite as unknown as ReturnType<typeof vi.fn>

    await renderWithQuery(<SuiteForm projectId="project-1" suite={suite} />)
    const description = screen.getByLabelText('Description')
    await user.clear(description)
    await user.type(description, 'Covers checkout end to end')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(spy).toHaveBeenCalledWith('suite-1', { description: 'Covers checkout end to end' })
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects/project-1/suites/suite-1')
    })
  })

  it('navigates back without calling updateSuite when the form is submitted unchanged', async () => {
    const user = userEvent.setup()
    const { updateSuite } = await import('@/features/projects/suites/api/suites.api')
    const spy = updateSuite as unknown as ReturnType<typeof vi.fn>

    await renderWithQuery(<SuiteForm projectId="project-1" suite={suite} />)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(spy).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/projects/project-1/suites/suite-1')
  })

  it('a Cancel link returns to the suites list in create mode', async () => {
    await renderWithQuery(<SuiteForm projectId="project-1" />)
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/projects/project-1/suites',
    )
  })

  it('a Cancel link returns to the suite in edit mode', async () => {
    await renderWithQuery(<SuiteForm projectId="project-1" suite={suite} />)
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/projects/project-1/suites/suite-1',
    )
  })
})
