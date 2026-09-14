import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ConfirmDocumentationResult, TestCase } from '@qably/types'
import {
  ConfirmDocumentation,
  useConfirmDocumentationState,
} from '@/features/projects/suites/components/confirm-documentation'
import { renderWithQuery } from '@/lib/query-test-utils'

function result(
  overrides: Partial<ConfirmDocumentationResult> = {},
): ConfirmDocumentationResult {
  return {
    suiteId: 'suite-1',
    confirmedCaseIds: ['case-1', 'case-2'],
    confirmedCount: 2,
    skippedCaseIds: [],
    skippedCount: 0,
    documentationConfirmedAt: '2026-09-12T10:00:00.000Z',
    documentationConfirmedById: 'user-1',
    ...overrides,
  }
}

function testCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'tc-1',
    suiteId: 'suite-1',
    version: null,
    name: 'Empties the cart',
    objective: '',
    preconditions: [],
    steps: ['Open the cart', 'Remove every item'],
    expectedResult: 'The cart shows zero items',
    priority: 'medium',
    state: 'draft',
    executionMode: 'automated',
    ...overrides,
  }
}

function Panel({
  cases,
  onConfirm,
}: {
  cases: TestCase[]
  onConfirm: (caseIds: string[]) => Promise<ConfirmDocumentationResult>
}) {
  const confirmation = useConfirmDocumentationState(onConfirm)
  return <ConfirmDocumentation cases={cases} confirmation={confirmation} />
}

describe('ConfirmDocumentation', () => {
  it('renders nothing while no documented case is waiting', () => {
    const { container } = renderWithQuery(<Panel cases={[]} onConfirm={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('offers one action naming how many documented cases are waiting', () => {
    renderWithQuery(
      <Panel cases={[testCase({ id: 'tc-1' }), testCase({ id: 'tc-2' }), testCase({ id: 'tc-3' })]} onConfirm={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: /confirm 3 cases/i })).toBeInTheDocument()
  })

  it('counts a single waiting case in the singular', () => {
    renderWithQuery(<Panel cases={[testCase()]} onConfirm={vi.fn()} />)

    expect(screen.getByRole('button', { name: /confirm 1 case$/i })).toBeInTheDocument()
  })

  it('opens a dialog naming every waiting case when the action is clicked', async () => {
    const user = userEvent.setup()
    renderWithQuery(
      <Panel
        cases={[
          testCase({ id: 'tc-1', name: 'Empties the cart' }),
          testCase({ id: 'tc-2', name: 'Applies a discount code' }),
        ]}
        onConfirm={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /confirm 2 cases/i }))

    expect(
      screen.getByRole('dialog', { name: /2 documented cases are waiting for your confirmation/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Empties the cart')).toBeInTheDocument()
    expect(screen.getByText('Applies a discount code')).toBeInTheDocument()
  })

  it('closes the dialog without confirming when cancelled', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderWithQuery(<Panel cases={[testCase()]} onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: /confirm 1 case$/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('confirms once and closes the dialog on success', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(result())

    renderWithQuery(<Panel cases={[testCase({ id: 'tc-1' }), testCase({ id: 'tc-2' })]} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /confirm 2 cases/i }))

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /confirm 2 cases/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows a spinner and disables the confirm button while the request is in flight', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockReturnValue(new Promise(() => {}))

    renderWithQuery(<Panel cases={[testCase()]} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /confirm 1 case$/i }))

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /confirm 1 case$/i }))

    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: /confirming/i })).toBeDisabled()
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('keeps the dialog open and the action available when confirmation fails', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(new Error('network down'))

    renderWithQuery(<Panel cases={[testCase()]} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /confirm 1 case$/i }))

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /confirm 1 case$/i }))

    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: /confirm 1 case$/i })).toBeEnabled()
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('checks every case by default and sends all ids when nothing is unchecked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(result())

    renderWithQuery(
      <Panel cases={[testCase({ id: 'tc-1' }), testCase({ id: 'tc-2' })]} onConfirm={onConfirm} />,
    )
    await user.click(screen.getByRole('button', { name: /confirm 2 cases/i }))
    const dialog = screen.getByRole('dialog')

    const checkboxes = within(dialog).getAllByRole('checkbox')
    expect(checkboxes.every((box) => (box as HTMLInputElement).checked)).toBe(true)

    await user.click(within(dialog).getByRole('button', { name: /confirm 2 cases/i }))

    expect(onConfirm).toHaveBeenCalledWith(['tc-1', 'tc-2'], expect.anything())
  })

  it('sends only the checked case ids once one is unchecked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(result())

    renderWithQuery(
      <Panel
        cases={[
          testCase({ id: 'tc-1', name: 'Empties the cart' }),
          testCase({ id: 'tc-2', name: 'Applies a discount code' }),
        ]}
        onConfirm={onConfirm}
      />,
    )
    await user.click(screen.getByRole('button', { name: /confirm 2 cases/i }))
    const dialog = screen.getByRole('dialog')

    await user.click(within(dialog).getByRole('checkbox', { name: /applies a discount code/i }))
    await user.click(within(dialog).getByRole('button', { name: /confirm 1 case$/i }))

    expect(onConfirm).toHaveBeenCalledWith(['tc-1'], expect.anything())
  })

  it('disables the confirm action once every case is unchecked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    renderWithQuery(<Panel cases={[testCase({ id: 'tc-1', name: 'Empties the cart' })]} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /confirm 1 case$/i }))
    const dialog = screen.getByRole('dialog')

    await user.click(within(dialog).getByRole('checkbox', { name: /empties the cart/i }))

    expect(within(dialog).getByRole('button', { name: /confirm/i })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('marks the select-all checkbox as mixed once only some cases are checked', async () => {
    const user = userEvent.setup()

    renderWithQuery(
      <Panel
        cases={[
          testCase({ id: 'tc-1', name: 'Empties the cart' }),
          testCase({ id: 'tc-2', name: 'Applies a discount code' }),
        ]}
        onConfirm={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /confirm 2 cases/i }))
    const dialog = screen.getByRole('dialog')
    const selectAll = within(dialog).getByRole('checkbox', { name: /select all/i })
    expect(selectAll).toHaveAttribute('aria-checked', 'true')

    await user.click(within(dialog).getByRole('checkbox', { name: /applies a discount code/i }))

    expect(selectAll).toHaveAttribute('aria-checked', 'mixed')
  })

  it('never renders its own status or alert text, leaving outcome and error feedback to the toaster', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(result({ skippedCount: 1 }))

    renderWithQuery(<Panel cases={[testCase()]} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /confirm 1 case$/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /confirm 1 case$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
