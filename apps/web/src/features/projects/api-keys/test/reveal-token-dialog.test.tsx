import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ApiKeyWithSecret } from '@qably/types'
import { RevealTokenDialog } from '../components/reveal-token-dialog'

const createdKey: ApiKeyWithSecret = {
  id: 'key-1',
  projectId: 'proj-1',
  name: 'CI/CD Pipeline',
  prefix: 'qbly_a1b2c3',
  lastFour: '9f2a',
  createdAt: '2026-06-17T00:00:00Z',
  token: 'qbly_a1b2c3_supersecrettokenvalue',
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

describe('RevealTokenDialog', () => {
  it('does not render when there is no key to reveal', () => {
    render(<RevealTokenDialog apiKey={undefined} onDismiss={vi.fn()} />)
    expect(screen.queryByText('Key created')).not.toBeInTheDocument()
  })

  it('shows the token exactly once with a warning it will not be shown again', () => {
    render(<RevealTokenDialog apiKey={createdKey} onDismiss={vi.fn()} />)
    expect(screen.getByText('qbly_a1b2c3_supersecrettokenvalue')).toBeInTheDocument()
    expect(screen.getByText(/will not be shown again/)).toBeInTheDocument()
  })

  it('copies the token to the clipboard and announces it', async () => {
    const user = userEvent.setup()
    const writeText = stubClipboard()
    render(<RevealTokenDialog apiKey={createdKey} onDismiss={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(writeText).toHaveBeenCalledWith('qbly_a1b2c3_supersecrettokenvalue')
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
  })

  it('never writes the token to localStorage or sessionStorage', async () => {
    const user = userEvent.setup()
    stubClipboard()
    const localSetItem = vi.spyOn(Storage.prototype, 'setItem')
    render(<RevealTokenDialog apiKey={createdKey} onDismiss={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    for (const call of localSetItem.mock.calls) {
      expect(String(call[1])).not.toContain(createdKey.token)
    }
    localSetItem.mockRestore()
  })

  it('clears the token when dismissed', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<RevealTokenDialog apiKey={createdKey} onDismiss={onDismiss} />)

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
