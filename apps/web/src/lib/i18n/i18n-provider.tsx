'use client'

import { useEffect } from 'react'
import { apiRequest } from '@/lib/api-client'
import {
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  detectBrowserLocale,
  useI18nStore,
  type Locale,
} from './store'

interface MeResponse {
  locale: Locale | null
}

function isSupportedLocale(value: unknown): value is Locale {
  return (SUPPORTED_LOCALES as readonly unknown[]).includes(value)
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useI18nStore((s) => s.locale)

  useEffect(() => {
    const hasStoredChoice = window.localStorage.getItem(LOCALE_STORAGE_KEY) !== null

    void Promise.resolve(useI18nStore.persist.rehydrate()).then(() => {
      if (!hasStoredChoice) {
        useI18nStore.getState().setLocale(detectBrowserLocale())
      }

      void applyServerLocalePreference()
    })
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <>{children}</>
}

async function applyServerLocalePreference(): Promise<void> {
  try {
    const me = await apiRequest<MeResponse>('/me')

    if (isSupportedLocale(me.locale)) {
      useI18nStore.getState().setLocale(me.locale)
    }
  } catch {
    return
  }
}
