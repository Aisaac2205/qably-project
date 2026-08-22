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
    <section className="rounded-xl border border-border bg-surface p-5 shadow-2xs" aria-labelledby="language-heading">
      <div className="space-y-0.5">
        <h2 id="language-heading" className="text-sm font-semibold text-default">
          {t('settings.language.title')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('settings.language.description')}</p>
      </div>

      <div className="mt-4 inline-flex p-1 rounded-lg border border-border/80 bg-canvas/40 gap-1">
        {LANGUAGES.map((lang) => {
          const isSelected = locale === lang.value
          return (
            <button
              key={lang.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setLocale(lang.value)}
              className={[
                'px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 cursor-pointer active:scale-[0.98]',
                isSelected
                  ? 'bg-primary text-primary-fg shadow-2xs border border-primary'
                  : 'text-muted hover:text-default hover:bg-surface/50 border border-transparent',
              ].join(' ')}
            >
              {t(lang.labelKey)}
            </button>
          )
        })}
      </div>
    </section>
  )
}
