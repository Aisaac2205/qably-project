import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CaseFormDialog } from '@/features/projects/suites/components/case-form-dialog'
import { createMockTestCase } from '@/lib/test-utils'
import { renderWithQuery } from '@/lib/query-test-utils'
import * as suitesApi from '@/test/suites-api-stub'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

describe('CaseFormDialog', () => {
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
      renderWithQuery(
        <CaseFormDialog suiteId="suite-1" testCase={testCase} open onOpenChange={() => {}} />,
      )
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
      renderWithQuery(
        <CaseFormDialog suiteId="suite-1" testCase={testCase} open onOpenChange={() => {}} />,
      )
    })

    expect(screen.getByText('useCreateRun > redirects to dashboard on valid login')).toBeInTheDocument()
    expect(screen.getByText('src/features/runs/hooks/use-create-run.test.ts')).toBeInTheDocument()
  })

  it('does not show technical context for a manual case', async () => {
    const testCase = createMockTestCase({ executionMode: 'manual' })

    await act(async () => {
      renderWithQuery(
        <CaseFormDialog suiteId="suite-1" testCase={testCase} open onOpenChange={() => {}} />,
      )
    })

    expect(screen.queryByText('Raw name')).not.toBeInTheDocument()
  })

  it('prefills the objective and preconditions fields from the case', async () => {
    const testCase = createMockTestCase({
      objective: 'Verify the cart accepts a new item',
      preconditions: ['The cart is empty', 'The user is signed in'],
    })

    await act(async () => {
      renderWithQuery(
        <CaseFormDialog suiteId="suite-1" testCase={testCase} open onOpenChange={() => {}} />,
      )
    })

    expect(screen.getByLabelText(/objective/i)).toHaveValue(
      'Verify the cart accepts a new item',
    )
    expect(screen.getByLabelText(/preconditions/i)).toHaveValue(
      'The cart is empty\nThe user is signed in',
    )
  })

  it('submits the objective and a preconditions list split by line', async () => {
    const testCase = createMockTestCase({ objective: '', preconditions: [] })
    const updateCase = vi.spyOn(suitesApi, 'updateCase')
    const user = userEvent.setup()

    await act(async () => {
      renderWithQuery(
        <CaseFormDialog suiteId="suite-1" testCase={testCase} open onOpenChange={() => {}} />,
      )
    })

    await user.type(screen.getByLabelText(/objective/i), 'Verify the cart total')
    await user.type(
      screen.getByLabelText(/preconditions/i),
      'The cart is empty\nThe user is signed in',
    )
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(updateCase).toHaveBeenCalledWith(
      'suite-1',
      testCase.id,
      expect.objectContaining({
        objective: 'Verify the cart total',
        preconditions: ['The cart is empty', 'The user is signed in'],
      }),
    )
  })
})
