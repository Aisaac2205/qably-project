import { useI18nStore, type Locale } from '@/lib/i18n'

export function syncPreviewLocale(locale?: Locale): void {
  if (locale && useI18nStore.getState().locale !== locale) {
    useI18nStore.setState({ locale })
  }
}
