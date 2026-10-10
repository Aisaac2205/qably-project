import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AttributedCommit, RunDeltaDetail } from '@qably/types'
import { WhatChangedStrip } from '@/features/runs/components/what-changed-strip'

const SHA = 'abc1234'.padEnd(40, '0')

const COMMIT: AttributedCommit = {
  sha: SHA,
  message: 'fix: checkout total',
  author: 'Ada Lovelace',
  committedAt: '2026-06-16T10:00:00Z',
  url: `https://github.com/acme/app/commit/${SHA}`,
  branch: 'main',
}

function delta(overrides: Partial<RunDeltaDetail> = {}): RunDeltaDetail {
  return {
    regressions: [{ testCaseId: 'tc-1', caseName: 'Login with valid credentials' }],
    fixes: [{ testCaseId: 'tc-2', caseName: 'Reset password' }],
    attribution: null,
    ...overrides,
  }
}

function renderStrip(value: RunDeltaDetail | null) {
  return render(<WhatChangedStrip projectId="proj-1" suiteId="suite-1" delta={value} />)
}

describe('WhatChangedStrip', () => {
  it('renders nothing when there is no earlier run to compare against', () => {
    const { container } = renderStrip(null)

    expect(container).toBeEmptyDOMElement()
  })

  it('lists regressions and fixes without a commit block when attribution is null', () => {
    renderStrip(delta())

    const region = screen.getByRole('region', { name: 'What changed' })
    expect(region).toHaveTextContent('Login with valid credentials')
    expect(region).toHaveTextContent('Reset password')
    expect(screen.queryByRole('heading', { name: 'Candidate commits' })).not.toBeInTheDocument()
    expect(screen.queryByText(/does not prove which commit/)).not.toBeInTheDocument()
  })

  it('tolerates a payload that predates the attribution field', () => {
    const legacy = { regressions: [], fixes: [] } as unknown as RunDeltaDetail
    renderStrip(legacy)

    expect(screen.getByRole('region', { name: 'What changed' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Candidate commits' })).not.toBeInTheDocument()
  })

  it('shows the candidate commits inside the strip, after the changed cases', () => {
    renderStrip(
      delta({
        attribution: { kind: 'range', baseSha: 'b'.repeat(40), headSha: SHA, commits: [COMMIT] },
      }),
    )

    const region = screen.getByRole('region', { name: 'What changed' })
    const heading = within(region).getByRole('heading', { level: 3, name: 'Candidate commits' })
    expect(within(region).getByRole('heading', { level: 2, name: 'What changed' })).toBeInTheDocument()
    expect(within(region).getByRole('link', { name: 'Login with valid credentials' })).toBeInTheDocument()
    expect(
      within(region)
        .getByRole('link', { name: 'Login with valid credentials' })
        .compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(within(region).getByText('fix: checkout total')).toBeInTheDocument()
  })

  it('shows a neutral line when the range could not be proven', () => {
    renderStrip(delta({ attribution: { kind: 'unknown', reason: 'history_gap' } }))

    const region = screen.getByRole('region', { name: 'What changed' })
    expect(within(region).getByText('Some pushes between these runs were not recorded.')).toBeInTheDocument()
    expect(within(region).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the same-commit line when both runs ran one commit', () => {
    renderStrip(delta({ attribution: { kind: 'same_commit', sha: SHA } }))

    expect(screen.getByText('Both runs ran the same commit')).toBeInTheDocument()
  })
})
