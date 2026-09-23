export const MONOGRAM_TONES = [
  'pass',
  'fail',
  'blocked',
  'skip',
  'running',
  'warn',
] as const

export type MonogramTone = (typeof MONOGRAM_TONES)[number]

const MONOGRAM_TONE_CLASS_NAMES: Record<MonogramTone, string> = {
  pass: 'bg-qb-pass-bg text-qb-pass',
  fail: 'bg-qb-fail-bg text-qb-fail',
  blocked: 'bg-qb-blocked-bg text-qb-blocked',
  skip: 'bg-qb-skip-bg text-qb-skip',
  running: 'bg-qb-running-bg text-qb-running',
  warn: 'bg-qb-warn-bg text-qb-warn',
}

function hashToIndex(value: string, modulo: number): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % modulo
}

export function resolveMonogramTone(projectId: string): MonogramTone {
  return MONOGRAM_TONES[hashToIndex(projectId, MONOGRAM_TONES.length)]
}

export function monogramToneClassName(projectId: string): string {
  return MONOGRAM_TONE_CLASS_NAMES[resolveMonogramTone(projectId)]
}

export function monogramToneColor(projectId: string): string {
  return `var(--status-${resolveMonogramTone(projectId)})`
}
