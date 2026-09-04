import { screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RunDetail } from '@/features/runs/components/run-detail'
import { renderWithQuery } from '@/lib/query-test-utils'
import { runFixtures } from '@/test/runs-api-stub'
import type { RunRecord } from '@qably/types'

vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)
vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

function getFreshRun(): RunRecord {
  const run = runFixtures.find((r) => r.id === 'run-12')
  if (!run) throw new Error('run-12 not found in fixtures')
  return structuredClone(run)
}

describe('RunDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders run progress header', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    expect(screen.getByText('Run #12')).toBeInTheDocument()
  })

  it('renders keyboard shortcut hints', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    const hints = screen.getByLabelText('Keyboard shortcuts')
    expect(hints).toBeInTheDocument()
    expect(hints.textContent).toContain('Pass')
    expect(hints.textContent).toContain('Fail')
    expect(hints.textContent).toContain('Skip')
    expect(hints.textContent).toContain('Blocked')
  })

  it('hides the shortcut bar on a run reported by CI', async () => {
    const run = { ...getFreshRun(), source: 'github_actions' as const }
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    expect(screen.queryByLabelText('Keyboard shortcuts')).not.toBeInTheDocument()
    expect(screen.getByText(/cannot be edited here/i)).toBeInTheDocument()
  })

  it('does not change a case status on keypress in a run reported by CI', async () => {
    const run = { ...getFreshRun(), source: 'github_actions' as const }
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    const api = await import('@/features/runs/api/runs.api')
    const spy = vi.spyOn(api, 'updateRunCase')
    await userEvent.keyboard('p')
    expect(spy).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('keeps the shortcut bar on a manual run', async () => {
    const run = { ...getFreshRun(), source: 'manual' as const }
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    expect(screen.getByLabelText('Keyboard shortcuts')).toBeInTheDocument()
    expect(screen.queryByText(/cannot be edited here/i)).not.toBeInTheDocument()
  })

  it('renders case list with all cases', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    // run-12 has 6 cases. Names appear in both case list and detail pane
    const items = screen.getAllByText('Valid login redirects to dashboard')
    expect(items.length).toBe(2) // one in case list, one in detail
    expect(screen.getByText('Invalid credentials shows error')).toBeInTheDocument()
  })

  it('selects first case by default', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    const firstBtn = screen.getByRole('option', { name: /Valid login redirects to dashboard/i })
    expect(firstBtn).toHaveAttribute('aria-selected', 'true')
  })

  it('renders case detail for selected case', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    // Steps of first case should be visible in detail pane
    expect(screen.getByText('Navigate to /login')).toBeInTheDocument()
    expect(screen.getByText('Enter valid email and password')).toBeInTheDocument()
  })

  it('selects different case on click', async () => {
    const run = getFreshRun()
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    await user.click(screen.getByRole('option', { name: /Invalid credentials shows error/i }))
    const selectedBtn = screen.getByRole('option', { name: /Invalid credentials shows error/i })
    expect(selectedBtn).toHaveAttribute('aria-selected', 'true')
  })

  it('keyboard shortcut P marks selected case as pass', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    // First case is selected (tc-1). Press P.
    await act(async () => {
      fireEvent.keyDown(window, { key: 'p' })
    })
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('Status: Pass')
  })

  it('keyboard shortcut F marks selected case as fail', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    await act(async () => {
      fireEvent.keyDown(window, { key: 'f' })
    })
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('Status: Fail')
  })

  it('keyboard shortcut S marks selected case as skip', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    await act(async () => {
      fireEvent.keyDown(window, { key: 's' })
    })
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('Status: Skip')
  })

  it('keyboard shortcut B marks selected case as blocked', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    await act(async () => {
      fireEvent.keyDown(window, { key: 'b' })
    })
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('Status: Blocked')
  })

  it('keyboard ArrowRight moves to next case', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    // Now tc-2 should be selected
    const secondBtn = screen.getByRole('option', { name: /Invalid credentials shows error/i })
    expect(secondBtn).toHaveAttribute('aria-selected', 'true')
  })

  it('keyboard ArrowLeft moves to previous case', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    // Move to second case
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    // Move back to first
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    const firstBtn = screen.getByRole('option', { name: /Valid login redirects to dashboard/i })
    expect(firstBtn).toHaveAttribute('aria-selected', 'true')
  })

  it('keyboard R marks next pending case as running', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    // First case is tc-1 (pass). Next pending is tc-5 or tc-6.
    await act(async () => {
      fireEvent.keyDown(window, { key: 'r' })
    })
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('Status: Running')
  })

  it('announces status change via aria-live region', async () => {
    const run = getFreshRun()
    await act(async () => {
      renderWithQuery(<RunDetail projectId="proj-1" run={run} />)
    })
    await act(async () => {
      fireEvent.keyDown(window, { key: 'p' })
    })
    // The aria-live region should have been updated
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('Status: Pass')
  })
})
