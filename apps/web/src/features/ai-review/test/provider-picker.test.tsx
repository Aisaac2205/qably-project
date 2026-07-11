import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ProviderPicker } from '@/features/ai-review/components/provider-picker'
import type { AiProviderConnection } from '@qably/types'

const providers: AiProviderConnection[] = [
  { provider: 'claude', label: 'Claude', connected: true, model: 'claude-sonnet-4-20250514', maskedKey: 'sk-...abcd' },
  { provider: 'gemini', label: 'Gemini', connected: false, model: 'gemini-2.5-flash' },
]

describe('ProviderPicker', () => {
  it('only lists connected providers', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<ProviderPicker providers={providers} selected="claude" onSelect={vi.fn()} />)
    })
    await user.click(screen.getByRole('button', { name: /claude/i }))
    expect(await screen.findByText('Claude')).toBeInTheDocument()
    expect(screen.queryByText('Gemini')).not.toBeInTheDocument()
  })

  it('calls onSelect with the chosen provider', async () => {
    const providersWithBothConnected: AiProviderConnection[] = [
      providers[0],
      { ...providers[1], connected: true },
    ]
    const onSelect = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<ProviderPicker providers={providersWithBothConnected} selected="claude" onSelect={onSelect} />)
    })
    await user.click(screen.getByRole('button', { name: /claude/i }))
    await user.click(await screen.findByText('Gemini'))
    expect(onSelect).toHaveBeenCalledWith('gemini')
  })
})
