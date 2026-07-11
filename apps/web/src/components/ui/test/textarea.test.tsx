import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Textarea } from '@/components/ui/textarea'

describe('Textarea', () => {
  it('renders and accepts input', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<Textarea placeholder="Type here" onChange={onChange} />)
    })
    const el = screen.getByPlaceholderText('Type here')
    await user.type(el, 'hello')
    expect(onChange).toHaveBeenCalled()
  })

  it('applies a custom className alongside defaults', async () => {
    await act(async () => {
      render(<Textarea className="custom-class" placeholder="x" />)
    })
    expect(screen.getByPlaceholderText('x')).toHaveClass('custom-class')
  })
})
