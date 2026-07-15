'use client'

import { useEffect } from 'react'
import { useI18nStore } from './store'

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useI18nStore((s) => s.locale)

  useEffect(() => {
    useI18nStore.persist.rehydrate()
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <>{children}</>
}
