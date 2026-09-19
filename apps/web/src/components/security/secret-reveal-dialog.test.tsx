import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SecretRevealDialog } from './secret-reveal-dialog'

const defaultProps = {
  title: 'Key created',
  description: 'Copy this token now. It will not be shown again.',
  valueLabel: 'Token',
  copyAriaLabel: 'Copy',
  copiedAnnouncement: 'Copied',
  doneLabel: 'Done',
}

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  })
  return writeText
}

describe('SecretRevealDialog', () => {
  it('does not render when there is no value to reveal', () => {
    render(<SecretRevealDialog {...defaultProps} value={undefined} onDismiss={vi.fn()} />)
    expect(screen.queryByText('Key created')).not.toBeInTheDocument()
  })

  it('shows the secret exactly once with the given warning', () => {
    render(<SecretRevealDialog {...defaultProps} value="qbly_supersecret" onDismiss={vi.fn()} />)
    expect(screen.getByText('qbly_supersecret')).toBeInTheDocument()
    expect(screen.getByText(/will not be shown again/)).toBeInTheDocument()
  })

  it('copies the value to the clipboard and announces it', async () => {
    const user = userEvent.setup()
    const writeText = stubClipboard()
    render(<SecretRevealDialog {...defaultProps} value="qbly_supersecret" onDismiss={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(writeText).toHaveBeenCalledWith('qbly_supersecret')
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
  })

  it('never writes the value to localStorage or sessionStorage', async () => {
    const user = userEvent.setup()
    stubClipboard()
    const localSetItem = vi.spyOn(Storage.prototype, 'setItem')
    render(<SecretRevealDialog {...defaultProps} value="qbly_supersecret" onDismiss={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    for (const call of localSetItem.mock.calls) {
      expect(String(call[1])).not.toContain('qbly_supersecret')
    }
    localSetItem.mockRestore()
  })

  it('clears the value when dismissed', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<SecretRevealDialog {...defaultProps} value="qbly_supersecret" onDismiss={onDismiss} />)

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
