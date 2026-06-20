import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Label } from '@/components/ui/label'

describe('Label', () => {
  it('renders label text', async () => {
    await act(async () => {
      render(<Label>Email</Label>)
    })
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('renders with htmlFor attribute', async () => {
    await act(async () => {
      render(<Label htmlFor="email">Email</Label>)
    })
    expect(screen.getByText('Email')).toHaveAttribute('for', 'email')
  })

  it('clicking label focuses associated input', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(
        <>
          <Label htmlFor="test-field">Test Label</Label>
          <input id="test-field" type="text" />
        </>,
      )
    })
    const label = screen.getByText('Test Label')
    const input = screen.getByRole('textbox')
    input.blur()
    await user.click(label)
    expect(document.activeElement).toBe(input)
  })

  it('renders with a className', async () => {
    await act(async () => {
      render(<Label className="custom-label">Styled</Label>)
    })
    expect(screen.getByText('Styled')).toHaveClass('custom-label')
  })
})
