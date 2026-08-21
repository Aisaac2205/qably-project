'use client'

import { useEffect } from 'react'
import {
  LOCALE_STORAGE_KEY,
  detectBrowserLocale,
  useI18nStore,
} from './store'

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useI18nStore((s) => s.locale)

  useEffect(() => {
    const hasStoredChoice = window.localStorage.getItem(LOCALE_STORAGE_KEY) !== null

    void Promise.resolve(useI18nStore.persist.rehydrate()).then(() => {
      if (!hasStoredChoice) {
        useI18nStore.getState().setLocale(detectBrowserLocale())
      }
    })
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <>{children}</>
}
