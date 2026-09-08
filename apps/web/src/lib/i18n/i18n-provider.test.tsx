import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from './i18n-provider'
import { LOCALE_STORAGE_KEY, useI18nStore } from './store'
import { apiRequest } from '@/lib/api-client'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))

const request = vi.mocked(apiRequest)

beforeEach(() => {
  request.mockReset()
  localStorage.clear()
  Object.defineProperty(window.navigator, 'language', {
    value: 'es-AR',
    configurable: true,
  })
  Object.defineProperty(window.navigator, 'languages', {
    value: ['es-AR'],
    configurable: true,
  })
})

describe('I18nProvider', () => {
  it('renders children immediately without waiting for the server preference', () => {
    request.mockReturnValue(new Promise(() => {}))

    render(
      <I18nProvider>
        <p>content</p>
      </I18nProvider>,
    )

    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('falls back to the browser-detected locale when there is no persisted server preference', async () => {
    request.mockRejectedValue(new Error('unauthenticated'))

    render(
      <I18nProvider>
        <p>content</p>
      </I18nProvider>,
    )

    await waitFor(() => expect(useI18nStore.getState().locale).toBe('es'))
  })

  it('prefers the stored local choice over browser detection when the server has no preference', async () => {
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify({ state: { locale: 'en' }, version: 0 }),
    )
    request.mockResolvedValue({ locale: null })

    render(
      <I18nProvider>
        <p>content</p>
      </I18nProvider>,
    )

    await waitFor(() => expect(request).toHaveBeenCalled())
    expect(useI18nStore.getState().locale).toBe('en')
  })

  it('adopts the persisted server preference once it resolves, overriding local detection', async () => {
    request.mockResolvedValue({ locale: 'es' })

    render(
      <I18nProvider>
        <p>content</p>
      </I18nProvider>,
    )

    await waitFor(() => expect(useI18nStore.getState().locale).toBe('es'))
    expect(request).toHaveBeenCalledWith('/me')
  })
})
