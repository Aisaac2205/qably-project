import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ChatCasePicker } from '@/features/ai-review/components/chat-case-picker'
import type { AttachedCaseRecord } from '@qably/types'

const cases: AttachedCaseRecord[] = [
  { id: 'tc-1', name: 'Valid login redirects to dashboard', suiteName: 'Authentication' },
  { id: 'tc-2', name: 'Invalid credentials shows error', suiteName: 'Authentication' },
  { id: 'tc-3', name: 'Checkout with empty cart blocked', suiteName: 'Checkout' },
]

describe('ChatCasePicker', () => {
  it('lists the available cases when open', async () => {
    await act(async () => {
      render(
        <ChatCasePicker open cases={cases} excludedIds={[]} onOpenChange={vi.fn()} onSelect={vi.fn()} />,
      )
    })
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
    expect(screen.getByText('Checkout with empty cart blocked')).toBeInTheDocument()
  })

  it('renders nothing when closed', async () => {
    await act(async () => {
      render(
        <ChatCasePicker open={false} cases={cases} excludedIds={[]} onOpenChange={vi.fn()} onSelect={vi.fn()} />,
      )
    })
    expect(screen.queryByText('Valid login redirects to dashboard')).not.toBeInTheDocument()
  })

  it('filters the list as the user types', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(
        <ChatCasePicker open cases={cases} excludedIds={[]} onOpenChange={vi.fn()} onSelect={vi.fn()} />,
      )
    })

    await user.type(screen.getByRole('combobox', { name: 'Search cases' }), 'checkout')

    expect(screen.getByText('Checkout with empty cart blocked')).toBeInTheDocument()
    expect(screen.queryByText('Valid login redirects to dashboard')).not.toBeInTheDocument()
  })

  it('shows an empty state when nothing matches the search', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(
        <ChatCasePicker open cases={cases} excludedIds={[]} onOpenChange={vi.fn()} onSelect={vi.fn()} />,
      )
    })

    await user.type(screen.getByRole('combobox', { name: 'Search cases' }), 'nonexistent case')

    expect(screen.getByText('No cases match your search.')).toBeInTheDocument()
  })

  it('excludes already-attached cases from the list', async () => {
    await act(async () => {
      render(
        <ChatCasePicker
          open
          cases={cases}
          excludedIds={['tc-1']}
          onOpenChange={vi.fn()}
          onSelect={vi.fn()}
        />,
      )
    })

    expect(screen.queryByText('Valid login redirects to dashboard')).not.toBeInTheDocument()
    expect(screen.getByText('Invalid credentials shows error')).toBeInTheDocument()
  })

  it('calls onSelect with the chosen case', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(
        <ChatCasePicker open cases={cases} excludedIds={[]} onOpenChange={vi.fn()} onSelect={onSelect} />,
      )
    })

    await user.click(screen.getByText('Valid login redirects to dashboard'))

    expect(onSelect).toHaveBeenCalledWith(cases[0])
  })

  it('exposes combobox and listbox roles wired to each other', async () => {
    await act(async () => {
      render(
        <ChatCasePicker open cases={cases} excludedIds={[]} onOpenChange={vi.fn()} onSelect={vi.fn()} />,
      )
    })

    const input = screen.getByRole('combobox', { name: 'Search cases' })
    const listbox = screen.getByRole('listbox')

    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(input).toHaveAttribute('aria-controls', listbox.id)
    expect(screen.getAllByRole('option')).toHaveLength(cases.length)
  })

  it('moves the active option with ArrowDown/ArrowUp and selects it on Enter', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(
        <ChatCasePicker open cases={cases} excludedIds={[]} onOpenChange={vi.fn()} onSelect={onSelect} />,
      )
    })

    const input = screen.getByRole('combobox', { name: 'Search cases' })
    const options = screen.getAllByRole('option')

    expect(input).toHaveAttribute('aria-activedescendant', options[0].id)

    await user.type(input, '{ArrowDown}')
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id)
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')

    await user.type(input, '{ArrowUp}')
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id)

    await user.type(input, '{Enter}')
    expect(onSelect).toHaveBeenCalledWith(cases[0])
  })
})
