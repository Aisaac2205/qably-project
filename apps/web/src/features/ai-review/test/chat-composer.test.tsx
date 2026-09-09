import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ASSISTANT_MODEL_NAME } from '@qably/types'
import { ChatComposer } from '@/features/ai-review/components/chat-composer'

describe('ChatComposer', () => {
  it('names the model under the input, not above it', async () => {
    await act(async () => {
      render(<ChatComposer onSend={vi.fn()} />)
    })

    const textarea = screen.getByRole('textbox', { name: 'Message' })
    const model = screen.getByText(ASSISTANT_MODEL_NAME)

    expect(model).toBeInTheDocument()
    expect(
      textarea.compareDocumentPosition(model) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('labels the model chip for a screen reader', async () => {
    await act(async () => {
      render(<ChatComposer onSend={vi.fn()} />)
    })

    expect(screen.getByText(ASSISTANT_MODEL_NAME).parentElement).toHaveTextContent(
      /model|modelo/i,
    )
  })

  it('sends the typed message and clears the input', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<ChatComposer onSend={onSend} />)
    })
    const textarea = screen.getByRole('textbox', { name: 'Message' })
    await user.type(textarea, 'Hello there')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    expect(onSend).toHaveBeenCalledWith('Hello there')
    expect(textarea).toHaveValue('')
  })

  it('sends on Enter without Shift', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<ChatComposer onSend={onSend} />)
    })
    const textarea = screen.getByRole('textbox', { name: 'Message' })
    await user.type(textarea, 'Quick question{enter}')
    expect(onSend).toHaveBeenCalledWith('Quick question')
  })

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<ChatComposer onSend={onSend} />)
    })
    const textarea = screen.getByRole('textbox', { name: 'Message' })
    await user.type(textarea, 'Line one{Shift>}{enter}{/Shift}Line two')
    expect(onSend).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('Line one\nLine two')
  })

  it('prefills from initialValue', async () => {
    await act(async () => {
      render(<ChatComposer onSend={vi.fn()} initialValue="Sugiéreme casos de prueba para: Payment refunds" />)
    })
    expect(screen.getByDisplayValue('Sugiéreme casos de prueba para: Payment refunds')).toBeInTheDocument()
  })

  it('disables the textarea and send button while sending', async () => {
    await act(async () => {
      render(<ChatComposer onSend={vi.fn()} disabled />)
    })
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  it('caps the textarea at 4000 characters', async () => {
    await act(async () => {
      render(<ChatComposer onSend={vi.fn()} />)
    })
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('maxLength', '4000')
  })

  it('does not send an empty message', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<ChatComposer onSend={onSend} />)
    })
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Message' }), '   {enter}')
    expect(onSend).not.toHaveBeenCalled()
  })
})
