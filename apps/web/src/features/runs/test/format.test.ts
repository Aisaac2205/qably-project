import { describe, expect, it } from 'vitest'
import { runTitleParts } from '../lib/format'

describe('runTitleParts', () => {
  it('leads a CI run with its suite name and demotes the commit message to the subtitle', () => {
    expect(
      runTitleParts(
        { source: 'github_actions', name: 'Run #12', commitMessage: 'fix: checkout total' },
        'Checkout',
      ),
    ).toEqual({ title: 'Checkout', subtitle: 'fix: checkout total' })
  })

  it('falls back to the run name for a CI run when the suite name is unavailable (loading, errored, or deleted)', () => {
    expect(
      runTitleParts(
        { source: 'github_actions', name: 'Run #12', commitMessage: 'fix: checkout total' },
        '',
      ),
    ).toEqual({ title: 'Run #12', subtitle: 'fix: checkout total' })
  })

  it('leads a manual/api run with its own name and the suite name as the subtitle', () => {
    expect(
      runTitleParts({ source: 'manual', name: 'Smoke test' }, 'Checkout'),
    ).toEqual({ title: 'Smoke test', subtitle: 'Checkout' })
  })

  it('omits the subtitle for a manual/api run when the suite name is unavailable', () => {
    expect(
      runTitleParts({ source: 'manual', name: 'Smoke test' }, ''),
    ).toEqual({ title: 'Smoke test', subtitle: undefined })
  })
})
