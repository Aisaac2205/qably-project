import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { InlineEditableText } from '@/features/suites/components/inline-editable-text'

describe('InlineEditableText', () => {
  it('renders text by default', async () => {
    const onSave = vi.fn()
    await act(async () => { render(<InlineEditableText value="Hello" onSave={onSave} />) })
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('click swaps to input with current value', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    await act(async () => { render(<InlineEditableText value="Hello" onSave={onSave} />) })
    await user.click(screen.getByText('Hello'))
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('Hello')
  })

  it('Enter saves and calls onChange with new value', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    await act(async () => { render(<InlineEditableText value="Hello" onSave={onSave} />) })
    await user.click(screen.getByText('Hello'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'World')
    await user.keyboard('{Enter}')
    expect(onSave).toHaveBeenCalledWith('World')
    // Should swap back to text
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('Escape cancels and reverts to original', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    await act(async () => { render(<InlineEditableText value="Hello" onSave={onSave} />) })
    await user.click(screen.getByText('Hello'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Changed')
    await user.keyboard('{Escape}')
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('blur saves the value', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    await act(async () => { render(<InlineEditableText value="Hello" onSave={onSave} />) })
    await user.click(screen.getByText('Hello'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'New')
    await user.tab() // blur
    expect(onSave).toHaveBeenCalledWith('New')
  })

  it('rejects empty value and reverts', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    await act(async () => { render(<InlineEditableText value="Hello" onSave={onSave} />) })
    await user.click(screen.getByText('Hello'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.keyboard('{Enter}')
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
