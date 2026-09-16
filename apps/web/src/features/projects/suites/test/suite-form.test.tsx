import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Suite } from '@qably/types'
import { SuiteForm } from '@/features/projects/suites/components/suite-form'
import { renderWithQuery } from '@/lib/query-test-utils'
import { notify } from '@/lib/notify'
import { createMockTestCase } from '@/lib/test-utils'

const mockPush = vi.fn()
let searchParamsQuery = ''
let mockIsMobile = false

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(searchParamsQuery),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockIsMobile,
}))

vi.mock('@/lib/notify', () => ({
  notify: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}))

vi.mock('@/features/projects/suites/api/suites.api', async () => {
  const stub = await import('@/test/suites-api-stub')
  return {
    ...stub,
    updateSuite: vi.fn(stub.updateSuite),
    createSuite: vi.fn(stub.createSuite),
    createCase: vi.fn(stub.createCase),
    updateCase: vi.fn(stub.updateCase),
    deleteCase: vi.fn(stub.deleteCase),
  }
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
    searchParamsQuery = ''
    mockIsMobile = false
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

  it('shows an error toast and does not navigate when creating a suite fails', async () => {
    const user = userEvent.setup()
    const { createSuite } = await import('@/features/projects/suites/api/suites.api')
    const spy = createSuite as unknown as ReturnType<typeof vi.fn>
    spy.mockRejectedValueOnce(new Error('network down'))

    await renderWithQuery(<SuiteForm projectId="project-1" />)
    await user.type(screen.getByLabelText('Name'), 'Payments')
    await user.click(screen.getByRole('button', { name: 'Create suite' }))

    await vi.waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith("Couldn't save the suite. Try again.")
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows an error toast and does not navigate when updating a suite fails', async () => {
    const user = userEvent.setup()
    const { updateSuite } = await import('@/features/projects/suites/api/suites.api')
    const spy = updateSuite as unknown as ReturnType<typeof vi.fn>
    spy.mockRejectedValueOnce(new Error('network down'))

    await renderWithQuery(<SuiteForm projectId="project-1" suite={suite} />)
    const description = screen.getByLabelText('Description')
    await user.clear(description)
    await user.type(description, 'Covers checkout end to end')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith("Couldn't save the suite. Try again.")
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  describe('inline case management', () => {
    const suiteWithCases: Suite = {
      ...suite,
      cases: [
        createMockTestCase({ id: 'case-1', suiteId: 'suite-1', name: 'Existing case' }),
      ],
    }
    // suite-4 is the one suite in the shared mock-data fixture with no
    // pre-seeded cases of its own — needed so the "capture the real case
    // id" tests below can assert on the exact id createCase hands back,
    // instead of colliding with suite-1's unrelated seeded cases (which
    // the stub returns regardless of what this component's local `suite`
    // prop claims about it).
    const emptySuite: Suite = { ...suite, id: 'suite-4' }

    it('lists the suite cases and shows a prompt when none is selected', async () => {
      await renderWithQuery(<SuiteForm projectId="project-1" suite={suiteWithCases} />)
      expect(screen.getByText('Existing case')).toBeInTheDocument()
      expect(screen.getByText('No case selected')).toBeInTheDocument()
    })

    it('selecting a case opens it in the editor', async () => {
      const user = userEvent.setup()
      await renderWithQuery(<SuiteForm projectId="project-1" suite={suiteWithCases} />)
      await user.click(screen.getByText('Existing case'))
      expect(screen.getByLabelText('Title')).toHaveValue('Existing case')
    })

    it('disables the case list while the suite is saving', async () => {
      const user = userEvent.setup()
      const { createSuite } = await import('@/features/projects/suites/api/suites.api')
      const spy = createSuite as unknown as ReturnType<typeof vi.fn>
      let resolveCreate: (value: Suite) => void = () => {}
      spy.mockImplementationOnce(
        () => new Promise<Suite>((resolve) => { resolveCreate = resolve }),
      )

      await renderWithQuery(<SuiteForm projectId="project-1" />)
      await user.type(screen.getByLabelText('Name'), 'Payments')
      await user.click(screen.getByRole('button', { name: 'Create suite' }))

      expect(screen.getByRole('button', { name: 'Add case' })).toBeDisabled()

      await act(async () => {
        resolveCreate({ ...suite, id: 'suite-99' })
      })
      await vi.waitFor(() => {
        expect(mockPush).toHaveBeenCalled()
      })
    })

    it('adding a case creates a draft and selects it', async () => {
      const user = userEvent.setup()
      await renderWithQuery(<SuiteForm projectId="project-1" suite={suite} />)
      await user.click(screen.getByRole('button', { name: 'Add case' }))
      expect(screen.getByLabelText('Title')).toHaveValue('')
      expect(screen.getByRole('heading', { name: 'Untitled case' })).toBeInTheDocument()
    })

    it('blocks submit and selects the offending case when a case has no name', async () => {
      const user = userEvent.setup()
      await renderWithQuery(<SuiteForm projectId="project-1" suite={suite} />)
      await user.click(screen.getByRole('button', { name: 'Add case' }))
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(screen.getByText('A case title is required')).toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('creates the suite then each drafted case, in order, before navigating', async () => {
      const user = userEvent.setup()
      const { createCase } = await import('@/features/projects/suites/api/suites.api')
      const spy = createCase as unknown as ReturnType<typeof vi.fn>

      await renderWithQuery(<SuiteForm projectId="project-1" />)
      await user.type(screen.getByLabelText('Name'), 'Payments')

      await user.click(screen.getByRole('button', { name: 'Add case' }))
      await user.type(screen.getByLabelText('Title'), 'Charge card')

      await user.click(screen.getByRole('button', { name: 'Create suite' }))

      await vi.waitFor(() => {
        expect(spy).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ name: 'Charge card' }),
        )
      })
      await vi.waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/projects\/project-1\/suites\/.+/))
      })
    })

    it('captures the real case id after creating it, so editing it again in the same session actually saves', async () => {
      const user = userEvent.setup()
      const { updateCase } = await import('@/features/projects/suites/api/suites.api')
      const updateSpy = updateCase as unknown as ReturnType<typeof vi.fn>

      await renderWithQuery(<SuiteForm projectId="project-1" suite={emptySuite} />)

      await user.click(screen.getByRole('button', { name: 'Add case' }))
      await user.type(screen.getByLabelText('Title'), 'Newly created case')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await vi.waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/projects/project-1/suites/suite-4')
      })

      await user.click(screen.getByRole('button', { name: 'Newly created case' }))
      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Edited after first save')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          'suite-4',
          'case-1',
          expect.objectContaining({ name: 'Edited after first save' }),
        )
      })
    })

    it('creates two new cases in the same save, each keeping its own distinct id afterward', async () => {
      const user = userEvent.setup()
      const { updateCase } = await import('@/features/projects/suites/api/suites.api')
      const updateSpy = updateCase as unknown as ReturnType<typeof vi.fn>

      await renderWithQuery(<SuiteForm projectId="project-1" suite={emptySuite} />)

      await user.click(screen.getByRole('button', { name: 'Add case' }))
      await user.type(screen.getByLabelText('Title'), 'First new case')
      await user.click(screen.getByRole('button', { name: 'Add case' }))
      await user.type(screen.getByLabelText('Title'), 'Second new case')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await vi.waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/projects/project-1/suites/suite-4')
      })

      await user.click(screen.getByRole('button', { name: 'First new case' }))
      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'First new case v2')

      await user.click(screen.getByRole('button', { name: 'Second new case' }))
      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Second new case v2')

      await user.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          'suite-4',
          'case-1',
          expect.objectContaining({ name: 'First new case v2' }),
        )
      })
      expect(updateSpy).toHaveBeenCalledWith(
        'suite-4',
        'case-2',
        expect.objectContaining({ name: 'Second new case v2' }),
      )
    })

    it('a case created this session can be deleted with confirmation afterward, not silently dropped', async () => {
      const user = userEvent.setup()
      const { deleteCase } = await import('@/features/projects/suites/api/suites.api')
      const deleteSpy = deleteCase as unknown as ReturnType<typeof vi.fn>

      await renderWithQuery(<SuiteForm projectId="project-1" suite={emptySuite} />)

      await user.click(screen.getByRole('button', { name: 'Add case' }))
      await user.type(screen.getByLabelText('Title'), 'Soon to be deleted')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await vi.waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/projects/project-1/suites/suite-4')
      })

      await user.click(screen.getByRole('button', { name: 'Delete “Soon to be deleted”' }))
      expect(screen.getByText('Delete test case?')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Delete' }))
      await vi.waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith('suite-4', 'case-1')
      })
    })

    it('updates a changed existing case and creates a new one on save, in edit mode', async () => {
      const user = userEvent.setup()
      const { createCase, updateCase } = await import('@/features/projects/suites/api/suites.api')
      const createSpy = createCase as unknown as ReturnType<typeof vi.fn>
      const updateSpy = updateCase as unknown as ReturnType<typeof vi.fn>

      await renderWithQuery(<SuiteForm projectId="project-1" suite={suiteWithCases} />)

      await user.click(screen.getByText('Existing case'))
      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Existing case renamed')

      await user.click(screen.getByRole('button', { name: 'Add case' }))
      await user.type(screen.getByLabelText('Title'), 'Brand new case')

      await user.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          'suite-1',
          'case-1',
          expect.objectContaining({ name: 'Existing case renamed' }),
        )
      })
      expect(createSpy).toHaveBeenCalledWith(
        'suite-1',
        expect.objectContaining({ name: 'Brand new case' }),
      )
      await vi.waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/projects/project-1/suites/suite-1')
      })
    })

    it('removes a draft case immediately, without a confirm dialog or any mutation', async () => {
      const user = userEvent.setup()
      const { createCase, deleteCase } = await import('@/features/projects/suites/api/suites.api')

      await renderWithQuery(<SuiteForm projectId="project-1" suite={suite} />)
      await user.click(screen.getByRole('button', { name: 'Add case' }))
      await user.click(screen.getByRole('button', { name: 'Delete “Untitled case”' }))

      expect(screen.queryByText('Delete test case?')).not.toBeInTheDocument()
      expect(screen.queryByText('Untitled case')).not.toBeInTheDocument()
      expect(createCase).not.toHaveBeenCalled()
      expect(deleteCase).not.toHaveBeenCalled()
    })

    it('deleting an existing case asks for confirmation, then calls deleteCase', async () => {
      const user = userEvent.setup()
      const { deleteCase } = await import('@/features/projects/suites/api/suites.api')
      const spy = deleteCase as unknown as ReturnType<typeof vi.fn>

      await renderWithQuery(<SuiteForm projectId="project-1" suite={suiteWithCases} />)
      await user.click(screen.getByRole('button', { name: 'Delete “Existing case”' }))
      expect(screen.getByText('Delete test case?')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Delete' }))
      await vi.waitFor(() => {
        expect(spy).toHaveBeenCalledWith('suite-1', 'case-1')
      })
      expect(screen.queryByText('Existing case')).not.toBeInTheDocument()
    })

    it('preselects a new case draft when the route carries ?case=new', async () => {
      searchParamsQuery = 'case=new'
      await renderWithQuery(<SuiteForm projectId="project-1" suite={suite} />)
      expect(screen.getByLabelText('Title')).toHaveValue('')
    })

    it('preselects an existing case when the route carries its id', async () => {
      searchParamsQuery = 'case=case-1'
      await renderWithQuery(<SuiteForm projectId="project-1" suite={suiteWithCases} />)
      expect(screen.getByLabelText('Title')).toHaveValue('Existing case')
    })

    it('on mobile, selecting a case swaps the list for the editor, with a way back', async () => {
      mockIsMobile = true
      const user = userEvent.setup()
      await renderWithQuery(<SuiteForm projectId="project-1" suite={suiteWithCases} />)

      expect(screen.getByRole('button', { name: 'Add case' })).toBeInTheDocument()
      await user.click(screen.getByText('Existing case'))

      expect(screen.queryByRole('button', { name: 'Add case' })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Existing case' })).toBeInTheDocument()
      expect(screen.getByLabelText('Title')).toHaveValue('Existing case')

      await user.click(screen.getByRole('button', { name: 'Back to cases' }))
      expect(screen.getByRole('button', { name: 'Add case' })).toBeInTheDocument()
      expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Test cases/ })).toHaveFocus()
    })
  })
})
