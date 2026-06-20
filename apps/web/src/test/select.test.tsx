import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

describe('Select', () => {
  it('renders trigger', async () => {
    await act(async () => {
      render(
        <Select defaultValue="option1">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>,
      )
    })
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('click opens dropdown and click option selects', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(
        <Select defaultValue="option1">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>,
      )
    })
    const trigger = screen.getByRole('combobox')
    await act(async () => {
      await user.click(trigger)
    })
    expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Option 2' })).toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole('option', { name: 'Option 2' }))
    })
    // After selecting, the dropdown should close
    expect(screen.queryByRole('option', { name: 'Option 1' })).not.toBeInTheDocument()
  })

  it('keyboard navigable', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(
        <Select defaultValue="option1">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>,
      )
    })
    const trigger = screen.getByRole('combobox')
    trigger.focus()
    await act(async () => {
      await user.keyboard('{Enter}')
    })
    expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument()
  })
})
