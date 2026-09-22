import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ASSISTANT_MODEL_NAME } from '@qably/types'
import type { AttachedCaseRecord } from '@qably/types'
import { ChatComposer } from '@/features/ai-review/components/chat-composer'
import { renderWithQuery } from '@/lib/query-test-utils'

const attachedCase: AttachedCaseRecord = {
  id: 'tc-1',
  name: 'Valid login redirects to dashboard',
  suiteName: 'Authentication',
}

describe('ChatComposer', () => {
  it('names the model under the input, not above it', async () => {
    await act(async () => {
      renderWithQuery(<ChatComposer projectId="proj-1" onSend={vi.fn()} />)
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
      renderWithQuery(<ChatComposer projectId="proj-1" onSend={vi.fn()} />)
    })

    expect(screen.getByText(ASSISTANT_MODEL_NAME).parentElement).toHaveTextContent(
      /model|modelo/i,
    )
  })

  it('sends the typed message and clears the input', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<ChatComposer projectId="proj-1" onSend={onSend} />)
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
      renderWithQuery(<ChatComposer projectId="proj-1" onSend={onSend} />)
    })
    const textarea = screen.getByRole('textbox', { name: 'Message' })
    await user.type(textarea, 'Quick question{enter}')
    expect(onSend).toHaveBeenCalledWith('Quick question')
  })

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<ChatComposer projectId="proj-1" onSend={onSend} />)
    })
    const textarea = screen.getByRole('textbox', { name: 'Message' })
    await user.type(textarea, 'Line one{Shift>}{enter}{/Shift}Line two')
    expect(onSend).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('Line one\nLine two')
  })

  it('prefills from initialValue', async () => {
    await act(async () => {
      renderWithQuery(
        <ChatComposer
          projectId="proj-1"
          onSend={vi.fn()}
          initialValue="Sugiéreme casos de prueba para: Payment refunds"
        />,
      )
    })
    expect(screen.getByDisplayValue('Sugiéreme casos de prueba para: Payment refunds')).toBeInTheDocument()
  })

  it('disables the textarea and send button while sending', async () => {
    await act(async () => {
      renderWithQuery(<ChatComposer projectId="proj-1" onSend={vi.fn()} disabled />)
    })
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  it('caps the textarea at 4000 characters', async () => {
    await act(async () => {
      renderWithQuery(<ChatComposer projectId="proj-1" onSend={vi.fn()} />)
    })
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('maxLength', '4000')
  })

  it('does not send an empty message', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<ChatComposer projectId="proj-1" onSend={onSend} />)
    })
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Message' }), '   {enter}')
    expect(onSend).not.toHaveBeenCalled()
  })

  describe('attached cases', () => {
    it('seeds the chip row from initialAttachedCase', async () => {
      await act(async () => {
        renderWithQuery(
          <ChatComposer projectId="proj-1" onSend={vi.fn()} initialAttachedCase={attachedCase} />,
        )
      })

      expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
      expect(screen.getByText('Authentication')).toBeInTheDocument()
    })

    it('removes an attached case from the chip row', async () => {
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(
          <ChatComposer projectId="proj-1" onSend={vi.fn()} initialAttachedCase={attachedCase} />,
        )
      })

      await user.click(
        screen.getByRole('button', { name: 'Remove Valid login redirects to dashboard' }),
      )

      expect(screen.queryByText('Valid login redirects to dashboard')).not.toBeInTheDocument()
    })

    it('attaches a case chosen from the picker', async () => {
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(<ChatComposer projectId="proj-1" onSend={vi.fn()} />)
      })

      await user.click(screen.getByRole('button', { name: 'Attach a case' }))
      await user.click(await screen.findByText('Checkout with empty cart blocked'))

      expect(screen.getByText('Checkout with empty cart blocked')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('sends the attached cases and clears them after sending', async () => {
      const onSend = vi.fn()
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(
          <ChatComposer projectId="proj-1" onSend={onSend} initialAttachedCase={attachedCase} />,
        )
      })

      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Improve this case{enter}')

      expect(onSend).toHaveBeenCalledWith('Improve this case', [attachedCase])
      expect(screen.queryByText('Valid login redirects to dashboard')).not.toBeInTheDocument()
    })

    it('disables the attach control once 5 cases are attached', async () => {
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(
          <ChatComposer projectId="proj-1" onSend={vi.fn()} initialAttachedCase={attachedCase} />,
        )
      })

      const attachButton = screen.getByRole('button', { name: 'Attach a case' })
      expect(attachButton).not.toBeDisabled()

      for (const name of [
        'Invalid credentials shows error',
        'Reset password flow',
        'Checkout with empty cart blocked',
        'Discount code applied correctly',
      ]) {
        await user.click(attachButton)
        await user.click(await screen.findByText(name))
      }

      expect(screen.getByText('Discount code applied correctly')).toBeInTheDocument()
      expect(attachButton).toBeDisabled()
      expect(screen.getByText('You can attach up to 5 cases.')).toBeInTheDocument()
    })
  })
})
