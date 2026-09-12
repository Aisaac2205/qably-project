const LOCALE_NAME_KEYS: Record<string, string> = {
  es: 'suites.localeNameEs',
  en: 'suites.localeNameEn',
}

export function localeNameKey(locale: string): string {
  return LOCALE_NAME_KEYS[locale] ?? 'suites.localeNameOther'
}
