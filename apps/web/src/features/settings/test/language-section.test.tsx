import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { LanguageSection } from '@/features/settings/components/language-section'
import { useI18nStore } from '@/lib/i18n/store'

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

  it('moves the fill to the language the user picks', async () => {
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
})
