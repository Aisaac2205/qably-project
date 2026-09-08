import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageSection } from '@/features/settings/components/language-section'
import { updateMyLocale } from '@/features/settings/api/settings.api'
import { useI18nStore } from '@/lib/i18n/store'

vi.mock('@/features/settings/api/settings.api', () => ({
  updateMyLocale: vi.fn(),
}))

const updateMyLocaleMock = vi.mocked(updateMyLocale)

beforeEach(() => {
  updateMyLocaleMock.mockReset()
  updateMyLocaleMock.mockResolvedValue({ locale: 'es' })
})

afterEach(() => {
  act(() => useI18nStore.getState().setLocale('en'))
})

describe('LanguageSection', () => {
  it('marks the active language with the solid brand fill instead of a faint tint', async () => {
    await act(async () => {
      render(<LanguageSection />)
    })

    const english = screen.getByRole('button', { name: 'English' })
    const spanish = screen.getByRole('button', { name: 'Spanish' })

    expect(english).toHaveAttribute('aria-pressed', 'true')
    expect(english).toHaveClass('bg-primary', 'text-primary-fg')
    expect(spanish).toHaveAttribute('aria-pressed', 'false')
    expect(spanish).not.toHaveClass('bg-primary')
  })

  it('moves the fill to the language the user picks instantly, before the request settles', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<LanguageSection />)
    })

    await user.click(screen.getByRole('button', { name: 'Spanish' }))

    const spanish = screen.getByRole('button', { name: 'Español' })
    expect(spanish).toHaveAttribute('aria-pressed', 'true')
    expect(spanish).toHaveClass('bg-primary', 'text-primary-fg')
    expect(screen.getByRole('button', { name: 'Inglés' })).not.toHaveClass('bg-primary')
  })

  it('persists the chosen locale to the server', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<LanguageSection />)
    })

    await user.click(screen.getByRole('button', { name: 'Spanish' }))

    await waitFor(() => expect(updateMyLocaleMock).toHaveBeenCalledWith('es'))
  })

  it('rolls back and surfaces an error when the request fails', async () => {
    updateMyLocaleMock.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    await act(async () => {
      render(<LanguageSection />)
    })

    await user.click(screen.getByRole('button', { name: 'Spanish' }))

    const english = await screen.findByRole('button', { name: 'English' })
    expect(english).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('clears a previous error once a retry succeeds', async () => {
    updateMyLocaleMock.mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    await act(async () => {
      render(<LanguageSection />)
    })

    await user.click(screen.getByRole('button', { name: 'Spanish' }))
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: 'Spanish' }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
