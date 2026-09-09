'use client'

import { useState } from 'react'
import { useTranslation, useSetLocale, type Locale } from '@/lib/i18n'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { updateMyLocale } from '@/features/settings/api/settings.api'

const LANGUAGES: { value: Locale; labelKey: string }[] = [
  { value: 'en', labelKey: 'settings.language.english' },
  { value: 'es', labelKey: 'settings.language.spanish' },
]

export function LanguageSection() {
  const { t, locale } = useTranslation()
  const setLocale = useSetLocale()
  const [error, setError] = useState<string | null>(null)

  async function selectLocale(next: Locale) {
    if (next === locale) return

    const previous = locale
    setError(null)
    setLocale(next)

    try {
      await updateMyLocale(next)
    } catch {
      setLocale(previous)
      setError(t('settings.language.updateError'))
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-2xs" aria-labelledby="language-heading">
      <div className="space-y-0.5">
        <h2 id="language-heading" className="text-sm font-semibold text-default">
          {t('settings.language.title')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('settings.language.description')}</p>
      </div>

      <SegmentedControl
        className="mt-4"
        label={t('settings.language.title')}
        options={LANGUAGES.map((lang) => ({
          value: lang.value,
          label: t(lang.labelKey),
        }))}
        value={locale}
        onChange={(next) => {
          void selectLocale(next)
        }}
      />

      {error !== null && (
        <p role="alert" className="mt-2.5 text-xs text-fail">
          {error}
        </p>
      )}
    </section>
  )
}
