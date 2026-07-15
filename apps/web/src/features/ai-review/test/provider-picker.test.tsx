import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AiProviderConnection } from '@qably/types'

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === 'aiReview.selectedProvider') {
        return `Selected AI provider: ${params?.name || 'none'}`
      }
      if (key === 'aiReview.noProviderLabel') {
        return 'No provider'
      }
      if (key === 'common.none') {
        return 'None'
      }
      return key
    },
    locale: 'en',
  }),
}))

import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProviderPicker } from '@/features/ai-review/components/provider-picker'

const providers: AiProviderConnection[] = [
  { provider: 'claude', label: 'Claude', connected: true, model: 'claude-sonnet-4-20250514', maskedKey: 'sk-...abcd' },
  { provider: 'gemini', label: 'Gemini', connected: false, model: 'gemini-2.5-flash' },
]

describe('ProviderPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

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
