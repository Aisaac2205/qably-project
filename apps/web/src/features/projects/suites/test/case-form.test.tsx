import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CaseForm } from '@/features/projects/suites/components/case-form'
import { createMockTestCase } from '@/lib/test-utils'
import { renderWithQuery } from '@/lib/query-test-utils'
import * as suitesApi from '@/test/suites-api-stub'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

describe('CaseForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefills the name field with the humanized title for an automated draft case', async () => {
    const testCase = createMockTestCase({
      id: 'tc-9',
      name: 'Redirects to dashboard on valid login',
      executionMode: 'automated',
      automationKey: 'useCreateRun > redirects to dashboard on valid login',
      automationFilePath: 'src/features/runs/hooks/use-create-run.test.ts',
      state: 'draft',
    })

    await act(async () => {
      renderWithQuery(<CaseForm projectId="proj-1" suiteId="suite-1" testCase={testCase} />)
    })

    expect(screen.getByLabelText(/title/i)).toHaveValue('Redirects to dashboard on valid login')
  })

  it('shows the raw automation key and file path as read-only technical context', async () => {
    const testCase = createMockTestCase({
      id: 'tc-9',
      name: 'Redirects to dashboard on valid login',
      executionMode: 'automated',
      automationKey: 'useCreateRun > redirects to dashboard on valid login',
      automationFilePath: 'src/features/runs/hooks/use-create-run.test.ts',
      state: 'draft',
    })

    await act(async () => {
      renderWithQuery(<CaseForm projectId="proj-1" suiteId="suite-1" testCase={testCase} />)
    })

    expect(screen.getByText('useCreateRun > redirects to dashboard on valid login')).toBeInTheDocument()
    expect(screen.getByText('src/features/runs/hooks/use-create-run.test.ts')).toBeInTheDocument()
  })

  it('does not show technical context for a manual case', async () => {
    const testCase = createMockTestCase({ executionMode: 'manual' })

    await act(async () => {
      renderWithQuery(<CaseForm projectId="proj-1" suiteId="suite-1" testCase={testCase} />)
    })

    expect(screen.queryByText('Raw name')).not.toBeInTheDocument()
  })

  it('prefills the objective field and one row per precondition', async () => {
    const testCase = createMockTestCase({
      objective: 'Verify the cart accepts a new item',
      preconditions: ['The cart is empty', 'The user is signed in'],
    })

    await act(async () => {
      renderWithQuery(<CaseForm projectId="proj-1" suiteId="suite-1" testCase={testCase} />)
    })

    expect(screen.getByLabelText(/objective/i)).toHaveValue('Verify the cart accepts a new item')
    expect(screen.getByLabelText('Precondition 1')).toHaveValue('The cart is empty')
    expect(screen.getByLabelText('Precondition 2')).toHaveValue('The user is signed in')
  })

  it('submits the objective and the preconditions list, then navigates back to the suite', async () => {
    const testCase = createMockTestCase({ objective: '', preconditions: [] })
    const updateCase = vi.spyOn(suitesApi, 'updateCase')
    const user = userEvent.setup()

    await act(async () => {
      renderWithQuery(<CaseForm projectId="proj-1" suiteId="suite-1" testCase={testCase} />)
    })

    await user.type(screen.getByLabelText(/objective/i), 'Verify the cart total')
    await user.click(screen.getByRole('button', { name: 'Add precondition' }))
    await user.type(screen.getByLabelText('Precondition 1'), 'The cart is empty')
    await user.click(screen.getByRole('button', { name: 'Add precondition' }))
    await user.type(screen.getByLabelText('Precondition 2'), 'The user is signed in')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(updateCase).toHaveBeenCalledWith(
      'suite-1',
      testCase.id,
      expect.objectContaining({
        objective: 'Verify the cart total',
        preconditions: ['The cart is empty', 'The user is signed in'],
      }),
    )
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/suites/suite-1')
  })

  it('reorders steps before submitting', async () => {
    const testCase = createMockTestCase({ steps: ['First step', 'Second step'] })
    const updateCase = vi.spyOn(suitesApi, 'updateCase')
    const user = userEvent.setup()

    await act(async () => {
      renderWithQuery(<CaseForm projectId="proj-1" suiteId="suite-1" testCase={testCase} />)
    })

    await user.click(screen.getAllByRole('button', { name: 'Move down' })[0])
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(updateCase).toHaveBeenCalledWith(
      'suite-1',
      testCase.id,
      expect.objectContaining({ steps: ['Second step', 'First step'] }),
    )
  })

  it('shows the create title and button, and requires a name, when no case is passed', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<CaseForm projectId="proj-1" suiteId="suite-1" />)
    })

    expect(screen.getByRole('heading', { name: 'Add case' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create case' }))
    expect(screen.getByText('A case title is required')).toBeInTheDocument()
  })

  it('a Cancel link returns to the suite', async () => {
    await act(async () => {
      renderWithQuery(<CaseForm projectId="proj-1" suiteId="suite-1" />)
    })
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/projects/proj-1/suites/suite-1',
    )
  })
})
