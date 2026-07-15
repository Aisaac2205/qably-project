import '@testing-library/jest-dom'
import { afterEach, beforeEach } from 'vitest'
import { useI18nStore } from '@/lib/i18n'

beforeEach(() => {
  localStorage.clear()
  useI18nStore.setState({ locale: 'en' })
})

afterEach(() => {
  localStorage.clear()
  useI18nStore.setState({ locale: 'en' })
})

// Polyfill ResizeObserver for jsdom (needed by Recharts)
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}
