import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { AiProvidersSection } from '@/features/settings/components/ai-providers-section'
import { __resetStore } from '@/lib/mock-store'

describe('AiProvidersSection', () => {
  beforeEach(() => __resetStore())

  it('shows Claude as connected and Gemini as not connected', async () => {
    await act(async () => {
      render(<AiProvidersSection />)
    })
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getAllByText('Connected').length).toBeGreaterThan(0)
    expect(screen.getByText('Gemini')).toBeInTheDocument()
    expect(screen.getAllByText('Not connected').length).toBeGreaterThan(0)
  })

  it('connects Gemini after entering a key and clicking Connect', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<AiProvidersSection />)
    })
    const geminiInput = screen.getByLabelText('Gemini API key')
    await user.type(geminiInput, 'AIzaSyTESTKEY1234')
    await user.click(screen.getByRole('button', { name: 'Connect Gemini' }))
    expect(await screen.findAllByText('Connected')).not.toHaveLength(0)
  })

  it('disconnects Claude when Disconnect is clicked', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<AiProvidersSection />)
    })
    await user.click(screen.getByRole('button', { name: 'Disconnect Claude' }))
    expect(await screen.findAllByText('Not connected')).not.toHaveLength(0)
  })
})
