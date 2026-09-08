import en from './en.json'
import es from './es.json'

export type Locale = 'en' | 'es'

export const DEFAULT_LOCALE: Locale = 'en'

const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es']

interface AcceptLanguageEntry {
  tag: string
  q: number
}

function isSupportedLocale(candidate: string): candidate is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(candidate)
}

function primarySubtag(tag: string): string {
  return tag.trim().split(/[-_]/, 1)[0]?.toLowerCase() ?? ''
}

function parseAcceptLanguageEntry(part: string): AcceptLanguageEntry | null {
  const [rawTag, ...params] = part.trim().split(';')
  const tag = rawTag?.trim() ?? ''
  if (tag.length === 0) return null

  const qParam = params
    .map((param) => param.trim())
    .find((param) => param.startsWith('q='))
  const q = qParam === undefined ? 1 : Number.parseFloat(qParam.slice(2))

  return { tag, q: Number.isNaN(q) ? 0 : q }
}

export function parseAcceptLanguage(
  header: string | null | undefined,
): string[] {
  if (!header) return []

  return header
    .split(',')
    .map(parseAcceptLanguageEntry)
    .filter((entry): entry is AcceptLanguageEntry => entry !== null)
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.tag)
}

export function resolveLocale(
  ...candidates: (string | null | undefined)[]
): Locale {
  for (const candidate of candidates) {
    if (candidate == null) continue

    for (const tag of parseAcceptLanguage(candidate)) {
      const subtag = primarySubtag(tag)
      if (isSupportedLocale(subtag)) return subtag
    }
  }

  return DEFAULT_LOCALE
}

export { en, es }
