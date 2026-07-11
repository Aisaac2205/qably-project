import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ChatComposer } from '@/features/ai-review/components/chat-composer'
import type { AiProviderConnection } from '@qably/types'

const providers: AiProviderConnection[] = [
  { provider: 'claude', label: 'Claude', connected: true, model: 'claude-sonnet-4-20250514', maskedKey: 'sk-...abcd' },
]

describe('ChatComposer', () => {
  it('sends the typed message and clears the input', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(
        <ChatComposer
          providers={providers}
          selectedProvider="claude"
          onSelectProvider={vi.fn()}
          onSend={onSend}
        />,
      )
    })
    const textarea = screen.getByPlaceholderText('Ask about this project or request a new test case…')
    await user.type(textarea, 'Hello there')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    expect(onSend).toHaveBeenCalledWith('Hello there')
    expect(textarea).toHaveValue('')
  })

  it('disables Send when the input is empty', async () => {
    await act(async () => {
      render(
        <ChatComposer
          providers={providers}
          selectedProvider="claude"
          onSelectProvider={vi.fn()}
          onSend={vi.fn()}
        />,
      )
    })
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  it('sends on Enter without Shift', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(
        <ChatComposer
          providers={providers}
          selectedProvider="claude"
          onSelectProvider={vi.fn()}
          onSend={onSend}
        />,
      )
    })
    const textarea = screen.getByPlaceholderText('Ask about this project or request a new test case…')
    await user.type(textarea, 'Quick question{enter}')
    expect(onSend).toHaveBeenCalledWith('Quick question')
  })

  it('prefills from initialValue', async () => {
    await act(async () => {
      render(
        <ChatComposer
          providers={providers}
          selectedProvider="claude"
          onSelectProvider={vi.fn()}
          onSend={vi.fn()}
          initialValue="Sugiéreme casos de prueba para: Payment refunds"
        />,
      )
    })
    expect(screen.getByDisplayValue('Sugiéreme casos de prueba para: Payment refunds')).toBeInTheDocument()
  })
})
