import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import en from '@/locales/en.json'
import es from '@/locales/es.json'

export type Locale = 'en' | 'es'

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
      locale: 'en',
      setLocale: (locale) => set({ locale }),
      t: (key, params) => resolve(key, dictionaries[get().locale], params),
    }),
    {
      name: 'qably-locale',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
)
