'use client'

import { useCallback } from 'react'
import { useI18nStore, type Locale } from './store'

export function useLocale() {
  return useI18nStore((s) => s.locale)
}

export function useSetLocale() {
  return useI18nStore((s) => s.setLocale)
}

export function useTranslation() {
  const locale = useI18nStore((s) => s.locale)
  const t = useI18nStore((s) => s.t)

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => t(key, params),
    [t],
  )

  return { locale, t: translate }
}

export type { Locale }
