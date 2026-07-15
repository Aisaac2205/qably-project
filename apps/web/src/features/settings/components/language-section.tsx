'use client'

import { useTranslation, useSetLocale, type Locale } from '@/lib/i18n'

const LANGUAGES: { value: Locale; labelKey: string }[] = [
  { value: 'en', labelKey: 'settings.language.english' },
  { value: 'es', labelKey: 'settings.language.spanish' },
]

export function LanguageSection() {
  const { t, locale } = useTranslation()
  const setLocale = useSetLocale()

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold text-default">{t('settings.language.title')}</h3>
      <p className="text-xs text-muted-foreground mt-1 mb-4">{t('settings.language.description')}</p>

      <div className="flex gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.value}
            onClick={() => setLocale(lang.value)}
            className={[
              'px-4 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer',
              locale === lang.value
                ? 'bg-default text-surface border-default'
                : 'bg-surface text-default border-border hover:bg-canvas',
            ].join(' ')}
          >
            {t(lang.labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
