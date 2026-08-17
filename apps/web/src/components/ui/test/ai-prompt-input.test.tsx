import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AiPromptInput } from '@/components/ui/ai-prompt-input'

describe('AiPromptInput', () => {
  it('renders with default Gemini 3.5 Flash-Lite model selector', async () => {
    await act(async () => {
      render(<AiPromptInput />)
    })
    expect(screen.getByText('Gemini 3.5 Flash-Lite')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'AI prompt' })).toBeInTheDocument()
  })

  it('allows typing and triggers onSubmit on enter', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<AiPromptInput onSubmit={onSubmit} />)
    })
    const textarea = screen.getByRole('textbox', { name: 'AI prompt' })
    await user.type(textarea, 'Create a test for checkout flow{enter}')
    expect(onSubmit).toHaveBeenCalledWith('Create a test for checkout flow', expect.objectContaining({
      id: 'gemini-3.5-flash-lite',
    }))
  })

  it('does not have harsh border or ring on container', async () => {
    await act(async () => {
      render(<AiPromptInput />)
    })
    const container = screen.getByRole('textbox', { name: 'AI prompt' }).closest('[data-slot="ai-prompt-input"]')
    expect(container).not.toHaveClass('border-primary/50')
    expect(container).not.toHaveClass('focus-within:ring-1')
  })
})
