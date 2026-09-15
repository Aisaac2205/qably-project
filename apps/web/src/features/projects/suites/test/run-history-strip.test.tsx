import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RunStatus } from '@qably/types'
import { RunHistoryStrip } from '@/features/projects/suites/components/run-history-strip'

const fourRuns: RunStatus[] = ['fail', 'pass', 'pass', 'pass']

describe('RunHistoryStrip', () => {
  it('exposes the strip as a single accessible image', () => {
    render(<RunHistoryStrip history={fourRuns} passRate={75} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('renders one bar per run, oldest to newest', () => {
    render(<RunHistoryStrip history={fourRuns} passRate={75} />)
    for (let i = 0; i < fourRuns.length; i++) {
      expect(screen.getByTestId(`run-history-bar-${i}`)).toBeInTheDocument()
    }
  })

  it('colors each bar by its own run status', () => {
    render(<RunHistoryStrip history={fourRuns} passRate={75} />)
    expect(screen.getByTestId('run-history-bar-0').className).toContain('bg-fail')
    expect(screen.getByTestId('run-history-bar-1').className).toContain('bg-pass')
  })

  it('summarizes the count, pass/fail split, and pass rate in the aria-label', () => {
    render(<RunHistoryStrip history={fourRuns} passRate={75} />)
    const label = screen.getByRole('img').getAttribute('aria-label') ?? ''
    expect(label).toMatch(/4/)
    expect(label).toMatch(/3/)
    expect(label).toMatch(/1/)
    expect(label).toMatch(/75/)
  })

  it('uses the singular wording for a single run', () => {
    render(<RunHistoryStrip history={['pass']} passRate={100} />)
    const label = screen.getByRole('img').getAttribute('aria-label') ?? ''
    expect(label).toMatch(/^Last 1 run:/)
  })

  it('uses the plural wording for more than one run', () => {
    render(<RunHistoryStrip history={fourRuns} passRate={75} />)
    const label = screen.getByRole('img').getAttribute('aria-label') ?? ''
    expect(label).toMatch(/^Last 4 runs:/)
  })

  it('shows the numeric pass rate in tabular figures without a code-style typeface', () => {
    render(<RunHistoryStrip history={fourRuns} passRate={75} />)
    const value = screen.getByText('75%')
    expect(value.className).not.toContain('font-mono')
    expect(value.className).toContain('tabular-nums')
  })

  it('hides the redundant numeric value from the accessibility tree since the label already states it', () => {
    render(<RunHistoryStrip history={fourRuns} passRate={75} />)
    expect(screen.getByText('75%')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders no bars and a quiet label when there is no run history yet', () => {
    render(<RunHistoryStrip history={[]} passRate={0} />)
    expect(screen.queryByTestId('run-history-bar-0')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName(/no completed runs/i)
  })

  it('caps the visible bars so the strip width stays predictable, while the aria-label keeps the full count', () => {
    const eightRuns: RunStatus[] = ['pass', 'pass', 'fail', 'pass', 'fail', 'pass', 'pass', 'fail']
    render(<RunHistoryStrip history={eightRuns} passRate={62} />)
    expect(screen.getByTestId('run-history-bar-4')).toBeInTheDocument()
    expect(screen.queryByTestId('run-history-bar-5')).not.toBeInTheDocument()
    const label = screen.getByRole('img').getAttribute('aria-label') ?? ''
    expect(label).toMatch(/^Last 8 runs:/)
  })

  it('accepts a custom className on the root element', () => {
    render(<RunHistoryStrip history={fourRuns} passRate={75} className="ml-auto" />)
    expect(screen.getByRole('img').className).toContain('ml-auto')
  })

  it('omits the visible numeric echo when the caller already shows the pass rate nearby', () => {
    render(<RunHistoryStrip history={fourRuns} passRate={75} showValue={false} />)
    expect(screen.queryByText('75%')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName(/75/)
  })
})
