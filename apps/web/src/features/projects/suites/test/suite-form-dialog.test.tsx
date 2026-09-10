import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Suite } from '@qably/types'
import { SuiteFormDialog } from '@/features/projects/suites/components/suite-form-dialog'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/projects/suites/api/suites.api', async () => {
  const stub = await import('@/test/suites-api-stub')
  return { ...stub, updateSuite: vi.fn(stub.updateSuite) }
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
  isDefault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('SuiteFormDialog edit diff', () => {
  beforeEach(async () => {
    const { __resetSuitesStub } = await import('@/test/suites-api-stub')
    __resetSuitesStub()
    vi.clearAllMocks()
  })

  it('sends only the description when only the description changed', async () => {
    const user = userEvent.setup()
    const { updateSuite } = await import('@/features/projects/suites/api/suites.api')
    const spy = updateSuite as unknown as ReturnType<typeof vi.fn>

    renderWithQuery(
      <SuiteFormDialog projectId={suite.projectId} suite={suite} open onOpenChange={vi.fn()} />,
    )

    const description = screen.getByLabelText('Description')
    await user.clear(description)
    await user.type(description, 'Covers checkout end to end')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(spy).toHaveBeenCalledWith('suite-1', { description: 'Covers checkout end to end' })
  })

  it('sends nothing when the form is submitted unchanged', async () => {
    const user = userEvent.setup()
    const { updateSuite } = await import('@/features/projects/suites/api/suites.api')
    const spy = updateSuite as unknown as ReturnType<typeof vi.fn>

    renderWithQuery(
      <SuiteFormDialog projectId={suite.projectId} suite={suite} open onOpenChange={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(spy).not.toHaveBeenCalled()
  })

  it('sends the name when it actually changed', async () => {
    const user = userEvent.setup()
    const { updateSuite } = await import('@/features/projects/suites/api/suites.api')
    const spy = updateSuite as unknown as ReturnType<typeof vi.fn>

    renderWithQuery(
      <SuiteFormDialog projectId={suite.projectId} suite={suite} open onOpenChange={vi.fn()} />,
    )

    const name = screen.getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Payments')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(spy).toHaveBeenCalledWith('suite-1', { name: 'Payments' })
  })

  it('sends the tags only when they changed', async () => {
    const user = userEvent.setup()
    const { updateSuite } = await import('@/features/projects/suites/api/suites.api')
    const spy = updateSuite as unknown as ReturnType<typeof vi.fn>

    renderWithQuery(
      <SuiteFormDialog projectId={suite.projectId} suite={suite} open onOpenChange={vi.fn()} />,
    )

    const tags = screen.getByLabelText('Tags')
    await user.clear(tags)
    await user.type(tags, 'auth, payments, billing')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(spy).toHaveBeenCalledWith('suite-1', { tags: ['auth', 'payments', 'billing'] })
  })
})
