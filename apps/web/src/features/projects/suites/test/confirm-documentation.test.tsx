import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ConfirmDocumentationResult } from '@qably/types'
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

function Panel({
  pendingCount,
  onConfirm,
}: {
  pendingCount: number
  onConfirm: () => Promise<ConfirmDocumentationResult>
}) {
  const confirmation = useConfirmDocumentationState(onConfirm)
  return <ConfirmDocumentation pendingCount={pendingCount} confirmation={confirmation} />
}

describe('ConfirmDocumentation', () => {
  it('says how many documented cases are waiting and offers one action', () => {
    renderWithQuery(<Panel pendingCount={3} onConfirm={vi.fn()} />)

    expect(
      screen.getByText(/3 documented cases are waiting for your confirmation/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /confirm documentation/i }),
    ).toBeInTheDocument()
  })

  it('counts a single waiting case in the singular', () => {
    renderWithQuery(<Panel pendingCount={1} onConfirm={vi.fn()} />)

    expect(
      screen.getByText(/1 documented case is waiting for your confirmation/i),
    ).toBeInTheDocument()
  })

  it('renders nothing while no documented case is waiting', () => {
    const { container } = renderWithQuery(<Panel pendingCount={0} onConfirm={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('confirms once and reports the outcome in a polite live region', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(result())

    renderWithQuery(<Panel pendingCount={2} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /confirm documentation/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/2 cases were confirmed/i)
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('names the cases it could not confirm instead of dropping them silently', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(
      result({ confirmedCount: 2, skippedCaseIds: ['case-9'], skippedCount: 1 }),
    )

    renderWithQuery(<Panel pendingCount={3} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /confirm documentation/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/1 case stayed unconfirmed because it has no documentation yet/i),
      ).toBeInTheDocument()
    })
  })

  it('announces a failure assertively and keeps the action available', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(new Error('network down'))

    renderWithQuery(<Panel pendingCount={2} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /confirm documentation/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /could not confirm the documentation/i,
      )
    })
    expect(
      screen.getByRole('button', { name: /confirm documentation/i }),
    ).toBeEnabled()
  })

  it('blocks a second submission while the first is still in flight', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockReturnValue(new Promise(() => {}))

    renderWithQuery(<Panel pendingCount={2} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /confirm documentation/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirming/i })).toBeDisabled()
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})

describe('ConfirmDocumentation pending feedback', () => {
  it('shows a spinner inside the button while the confirmation is in flight', async () => {
    const user = userEvent.setup()
    let release: (value: ConfirmDocumentationResult) => void = () => {}
    const onConfirm = vi.fn(
      () =>
        new Promise<ConfirmDocumentationResult>((resolve) => {
          release = resolve
        }),
    )

    const { container } = renderWithQuery(
      <Panel pendingCount={3} onConfirm={onConfirm} />,
    )
    await user.click(screen.getByRole('button', { name: /confirm documentation/i }))

    await waitFor(() => {
      expect(container.querySelector('.spinner')).not.toBeNull()
    })

    release(result())
    await waitFor(() => {
      expect(container.querySelector('.spinner')).toBeNull()
    })
  })

  it('keeps the spinner out of the accessibility tree so the button name stays readable', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn(() => new Promise<ConfirmDocumentationResult>(() => {}))

    const { container } = renderWithQuery(
      <Panel pendingCount={3} onConfirm={onConfirm} />,
    )
    await user.click(screen.getByRole('button', { name: /confirm documentation/i }))

    await waitFor(() => {
      expect(container.querySelector('.spinner')).toHaveAttribute('aria-hidden', 'true')
    })
    expect(screen.getByRole('button', { name: /confirming/i })).toBeInTheDocument()
  })
})
