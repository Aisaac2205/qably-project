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

export function toneForPassRatePercent(percent: number): PassRateTone {
  if (percent >= 70) return 'pass'
  if (percent > 0) return 'warn'
  return 'fail'
}
