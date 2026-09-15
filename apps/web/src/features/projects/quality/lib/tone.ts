export type PassRateTone = 'pass' | 'warn' | 'fail'

export const TONE_TEXT_CLASSES: Record<PassRateTone, string> = {
  pass: 'text-pass',
  warn: 'text-warn',
  fail: 'text-fail',
}

export const TONE_SOLID_BG_CLASSES: Record<PassRateTone, string> = {
  pass: 'bg-pass',
  warn: 'bg-warn',
  fail: 'bg-fail',
}

/**
 * Shared pass-rate → status tone mapping for the quality page's charts
 * (trend line, current-state ring, suite meters), so every chart derives
 * its color from the same thresholds instead of inventing its own.
 */
export function toneForPassRatePercent(percent: number): PassRateTone {
  if (percent >= 70) return 'pass'
  if (percent > 0) return 'warn'
  return 'fail'
}
