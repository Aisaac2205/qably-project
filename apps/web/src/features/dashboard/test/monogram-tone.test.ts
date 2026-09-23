import { describe, expect, it } from 'vitest'
import {
  MONOGRAM_TONES,
  monogramToneClassName,
  monogramToneColor,
  resolveMonogramTone,
} from '@/features/dashboard/lib/monogram-tone'

describe('resolveMonogramTone', () => {
  it('renders the same tone for the same project id across two calls', () => {
    expect(resolveMonogramTone('project-1')).toBe(resolveMonogramTone('project-1'))
  })

  it('picks a tone from the status-tinted palette', () => {
    expect(MONOGRAM_TONES).toContain(resolveMonogramTone('project-1'))
  })

  it('is likely to disagree for two different project ids', () => {
    expect(resolveMonogramTone('project-1')).not.toBe(resolveMonogramTone('project-2'))
  })
})

describe('monogramToneClassName', () => {
  it('pairs a tinted background with its matching foreground token', () => {
    const tone = resolveMonogramTone('project-1')
    expect(monogramToneClassName('project-1')).toBe(`bg-qb-${tone}-bg text-qb-${tone}`)
  })

  it('is deterministic across calls', () => {
    expect(monogramToneClassName('project-3')).toBe(monogramToneClassName('project-3'))
  })
})

describe('monogramToneColor', () => {
  it('resolves to the raw status css variable matching the tone', () => {
    const tone = resolveMonogramTone('project-1')
    expect(monogramToneColor('project-1')).toBe(`var(--status-${tone})`)
  })
})
