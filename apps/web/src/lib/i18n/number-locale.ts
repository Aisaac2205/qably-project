/**
 * Resolves the BCP 47 tag used for number formatting (thousands separators,
 * decimal marks). Kept apart from date-locale resolution: Spanish dates stay
 * on 'es-ES' (month names don't vary), but Spanish numbers resolve to
 * 'es-MX' so grouping uses a comma ("30,786") instead of the 'es-ES' dot
 * ("30.678") the user does not want.
 */
export function resolveNumberLocale(locale: string | undefined | null): string {
  if (!locale) return 'en-US'
  return locale.toLowerCase().startsWith('es') ? 'es-MX' : 'en-US'
}
