import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

function renderSelect() {
  return render(
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
}

describe('Select', () => {
  it('renders the label of the selected item, not the raw value', () => {
    render(
      <Select
        defaultValue="recent"
        items={[
          { value: 'recent', label: 'Most recent' },
          { value: 'name', label: 'Name (A to Z)' },
        ]}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Most recent</SelectItem>
          <SelectItem value="name">Name (A to Z)</SelectItem>
        </SelectContent>
      </Select>,
    )

    expect(screen.getByRole('combobox').textContent).toContain('Most recent')
    expect(screen.getByRole('combobox').textContent).not.toContain('recent,')
  })

  it('renders trigger', () => {
    renderSelect()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('click opens dropdown and click option selects', async () => {
    const user = userEvent.setup()
    renderSelect()

    await user.click(screen.getByRole('combobox'))
    expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Option 2' })).toBeInTheDocument()

    await user.click(screen.getByRole('option', { name: 'Option 2' }))
    expect(
      screen.queryByRole('option', { name: 'Option 1' }),
    ).not.toBeInTheDocument()
  })

  it('keyboard navigable', async () => {
    const user = userEvent.setup()
    renderSelect()

    screen.getByRole('combobox').focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument()
  })
})
