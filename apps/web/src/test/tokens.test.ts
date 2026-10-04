import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('globals.css token system', () => {
  it('defines --bg token', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../app/globals.css'),
      'utf-8'
    )
    expect(css).toContain('--bg:')
  })

  it('defines --primary token', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../app/globals.css'),
      'utf-8'
    )
    expect(css).toContain('--primary:')
  })

  it('defines all 6 status tokens', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../app/globals.css'),
      'utf-8'
    )
    const statuses = ['--status-pass', '--status-fail', '--status-blocked', '--status-skip', '--status-running', '--status-warn']
    statuses.forEach(token => {
      expect(css).toContain(token)
    })
  })

  it('uses oklch not hex for brand colors', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../app/globals.css'),
      'utf-8'
    )
    const primaryLine = css.split('\n').find(l => l.includes('--primary:') && !l.includes('--primary-'))
    expect(primaryLine).toContain('oklch')
  })
})

function readTokens(): Map<string, string> {
  const css = fs
    .readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const tokens = new Map<string, string>()

  for (const match of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)) {
    tokens.set(match[1], match[2].trim())
  }

  return tokens
}

function aliasTarget(value: string | undefined): string | undefined {
  return value?.match(/^var\((--[a-z0-9-]+)\)$/)?.[1]
}

function resolveToken(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name)

  if (value === undefined) throw new Error(`${name} is not declared`)

  const target = aliasTarget(value)

  return target === undefined ? value : resolveToken(tokens, target)
}

function aliasesOf(tokens: Map<string, string>, name: string): string[] {
  const reaches = (candidate: string): boolean => {
    const target = aliasTarget(tokens.get(candidate))

    return target !== undefined && (target === name || reaches(target))
  }

  return [...tokens.keys()].filter(reaches).sort()
}

function parseOklch(value: string): { l: number; c: number; h: number } {
  const match = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/)

  if (match === null) throw new Error(`${value} is not an oklch() color`)

  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) }
}

describe('runs surface token', () => {
  it('declares a neutral hover surface with zero chroma', () => {
    const tokens = readTokens()

    expect(aliasTarget(tokens.get('--runs-hover'))).toBeUndefined()
    expect(parseOklch(resolveToken(tokens, '--runs-hover'))).toMatchObject({ l: 0.935, c: 0 })
  })

  it('exposes the token to Tailwind as bg-runs-hover', () => {
    expect(readTokens().get('--color-runs-hover')).toBe('var(--runs-hover)')
  })
})

describe('shared grey tokens stay untouched', () => {
  const pinned = [
    {
      token: '--bg',
      value: 'oklch(0.970 0.006 260)',
      aliases: ['--background', '--color-background', '--color-canvas', '--color-qb-canvas'],
    },
    {
      token: '--bg-sidebar-hover',
      value: 'oklch(0.958 0.007 260)',
      aliases: ['--color-sidebar-hover'],
    },
    {
      token: '--bg-sidebar-active',
      value: 'oklch(0.945 0.008 260)',
      aliases: ['--color-sidebar-accent', '--color-sidebar-active', '--sidebar-accent'],
    },
    {
      token: '--surface-hover',
      value: 'oklch(0.935 0.008 260)',
      aliases: [
        '--chart-segment-background',
        '--color-canvas-hover',
        '--color-qb-canvas-hover',
        '--color-surface-hover',
      ],
    },
    {
      token: '--heatmap-l0',
      value: 'oklch(0.935 0.008 260)',
      aliases: ['--color-heatmap-l0', '--color-qb-heatmap-l0'],
    },
  ]

  it.each(pinned)('keeps $token at $value', ({ token, value }) => {
    expect(readTokens().get(token)).toBe(value)
  })

  it.each(pinned)('keeps every alias of $token pointing at it', ({ token, value, aliases }) => {
    const tokens = readTokens()

    expect(aliasesOf(tokens, token)).toStrictEqual(aliases)
    for (const alias of aliases) {
      expect(resolveToken(tokens, alias)).toBe(value)
    }
  })

  it('keeps the chart segment background on the shared hover surface', () => {
    expect(resolveToken(readTokens(), '--chart-segment-background')).toBe('oklch(0.935 0.008 260)')
  })
})
