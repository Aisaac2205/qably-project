import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Input } from '@/components/ui/input'

describe('Input', () => {
  it('renders an input element', async () => {
    await act(async () => {
      render(<Input aria-label="Test input" />)
    })
    expect(screen.getByRole('textbox', { name: 'Test input' })).toBeInTheDocument()
  })

  it('accepts a value', async () => {
    await act(async () => {
      render(<Input defaultValue="hello" aria-label="Value input" />)
    })
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
  })

  it('fires onChange', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<Input aria-label="Change input" onChange={onChange} />)
    })
    const input = screen.getByRole('textbox')
    await user.type(input, 'x')
    expect(onChange).toHaveBeenCalled()
  })

  it('accepts disabled state', async () => {
    await act(async () => {
      render(<Input disabled aria-label="Disabled input" />)
    })
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('accepts aria-invalid state', async () => {
    await act(async () => {
      render(<Input aria-invalid aria-label="Invalid input" />)
    })
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('renders with a className', async () => {
    await act(async () => {
      render(<Input className="custom-class" aria-label="Class input" />)
    })
    expect(screen.getByRole('textbox')).toHaveClass('custom-class')
  })
})
