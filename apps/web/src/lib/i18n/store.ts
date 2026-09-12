import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { en, es, DEFAULT_LOCALE, type Locale } from '@qably/i18n'

export type { Locale }

export { DEFAULT_LOCALE }

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es']
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

function lookup(path: string, dict: Dict): unknown {
  const keys = path.split('.')
  let current: unknown = dict
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Dict)[key]
  }
  return current
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template

  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value))
  }, template)
}

function resolve(path: string, dict: Dict, params?: Record<string, string | number>): string {
  const count = params?.count

  if (typeof count === 'number') {
    const plural = lookup(`${path}${count === 1 ? '_one' : '_other'}`, dict)
    if (typeof plural === 'string') return interpolate(plural, params)
  }

  const entry = lookup(path, dict)
  if (typeof entry !== 'string') return path

  return interpolate(entry, params)
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
