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
