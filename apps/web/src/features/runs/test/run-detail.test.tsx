import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { RunDetail } from '@/features/runs/components/run-detail'
import { __resetStore, getRun } from '@/lib/mock-store'
import type { Run } from '@qably/types'

function getFreshRun(): Run {
  const r = getRun('run-12')
  if (!r) throw new Error('run-12 not found in store')
  return JSON.parse(JSON.stringify(r))
}

describe('RunDetail', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders run progress header', async () => {
    const run = getFreshRun()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    expect(screen.getByText('Run #12')).toBeInTheDocument()
  })

  it('renders keyboard shortcut hints', async () => {
    const run = getFreshRun()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    const hints = screen.getByLabelText('Keyboard shortcuts')
    expect(hints).toBeInTheDocument()
    expect(hints.textContent).toContain('Pass')
    expect(hints.textContent).toContain('Fail')
    expect(hints.textContent).toContain('Skip')
    expect(hints.textContent).toContain('Blocked')
  })

  it('renders case list with all cases', async () => {
    const run = getFreshRun()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    // run-12 has 6 cases. Names appear in both case list and detail pane
    const items = screen.getAllByText('Valid login redirects to dashboard')
    expect(items.length).toBe(2) // one in case list, one in detail
    expect(screen.getByText('Invalid credentials shows error')).toBeInTheDocument()
  })

  it('selects first case by default', async () => {
    const run = getFreshRun()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    const firstBtn = screen.getByRole('option', { name: /Valid login redirects to dashboard/i })
    expect(firstBtn).toHaveAttribute('aria-selected', 'true')
  })

  it('renders case detail for selected case', async () => {
    const run = getFreshRun()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    // Steps of first case should be visible in detail pane
    expect(screen.getByText('Navigate to /login')).toBeInTheDocument()
    expect(screen.getByText('Enter valid email and password')).toBeInTheDocument()
  })

  it('selects different case on click', async () => {
    const run = getFreshRun()
    const user = userEvent.setup()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    await user.click(screen.getByRole('option', { name: /Invalid credentials shows error/i }))
    const selectedBtn = screen.getByRole('option', { name: /Invalid credentials shows error/i })
    expect(selectedBtn).toHaveAttribute('aria-selected', 'true')
  })

  it('keyboard shortcut P marks selected case as pass', async () => {
    const run = getFreshRun()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    // First case is selected (tc-1). Press P.
    fireEvent.keyDown(window, { key: 'p' })
    // The store should have updated
    const updated = getRun('run-12')
    const tc1 = updated?.cases.find((c) => c.id === 'tc-1')
    expect(tc1?.status).toBe('pass')
  })

  it('keyboard shortcut F marks selected case as fail', async () => {
    const run = getFreshRun()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    fireEvent.keyDown(window, { key: 'f' })
    const updated = getRun('run-12')
    const tc1 = updated?.cases.find((c) => c.id === 'tc-1')
    expect(tc1?.status).toBe('fail')
  })

  it('keyboard shortcut S marks selected case as skip', async () => {
    const run = getFreshRun()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    fireEvent.keyDown(window, { key: 's' })
    const updated = getRun('run-12')
    const tc1 = updated?.cases.find((c) => c.id === 'tc-1')
    expect(tc1?.status).toBe('skip')
  })

  it('keyboard shortcut B marks selected case as blocked', async () => {
    const run = getFreshRun()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    fireEvent.keyDown(window, { key: 'b' })
    const updated = getRun('run-12')
    const tc1 = updated?.cases.find((c) => c.id === 'tc-1')
    expect(tc1?.status).toBe('blocked')
  })

  it('keyboard ArrowRight moves to next case', async () => {
    const run = getFreshRun()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    // Now tc-2 should be selected
    const secondBtn = screen.getByRole('option', { name: /Invalid credentials shows error/i })
    expect(secondBtn).toHaveAttribute('aria-selected', 'true')
  })

  it('keyboard ArrowLeft moves to previous case', async () => {
    const run = getFreshRun()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
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
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    // First case is tc-1 (pass). Next pending is tc-5 or tc-6.
    fireEvent.keyDown(window, { key: 'r' })
    const updated = getRun('run-12')
    // Should have set some pending case to running
    const runningCases = updated?.cases.filter((c) => c.status === 'running')
    expect(runningCases?.length).toBeGreaterThanOrEqual(1)
  })

  it('announces status change via aria-live region', async () => {
    const run = getFreshRun()
    await act(async () => {
      render(<RunDetail projectId="proj-1" run={run} />)
    })
    fireEvent.keyDown(window, { key: 'p' })
    // The aria-live region should have been updated
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('Status: Pass')
  })
})
