import { apiRequest } from '@/lib/api-client'
import type { Locale } from '@/lib/i18n'

export interface MeView {
  locale: Locale | null
}

export function updateMyLocale(locale: Locale): Promise<MeView> {
  return apiRequest<MeView>('/me', {
    method: 'PATCH',
    body: { locale },
  })
}
