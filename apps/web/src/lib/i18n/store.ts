import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import en from '@/locales/en.json'
import es from '@/locales/es.json'

export type Locale = 'en' | 'es'

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es']
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_STORAGE_KEY = 'qably-locale'

export function matchLocale(languageTags: readonly string[]): Locale {
  for (const tag of languageTags) {
    const base = tag.toLowerCase().split('-')[0]
    const supported = SUPPORTED_LOCALES.find((locale) => locale === base)
    if (supported) return supported
  }

  return DEFAULT_LOCALE
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE

  const tags = navigator.languages?.length
    ? navigator.languages
    : [navigator.language].filter(Boolean)

  return matchLocale(tags)
}

type Dict = Record<string, unknown>

const dictionaries: Record<Locale, Dict> = { en, es }

function resolve(path: string, dict: Dict, params?: Record<string, string | number>): string {
  const keys = path.split('.')
  let current: unknown = dict
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return path
    current = (current as Dict)[key]
  }
  if (typeof current !== 'string') return path
  
  if (!params) return current
  
  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value))
  }, current)
}

interface I18nState {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => set({ locale }),
      t: (key, params) => resolve(key, dictionaries[get().locale], params),
    }),
    {
      name: LOCALE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
)
