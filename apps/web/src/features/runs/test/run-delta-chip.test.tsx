import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RunDeltaChip } from '@/features/runs/components/run-delta-chip'

describe('RunDeltaChip', () => {
  it('renders nothing when the run has no previous run to compare against', () => {
    const { container } = render(<RunDeltaChip delta={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the three counts and names them for assistive technology', () => {
    render(<RunDeltaChip delta={{ regressions: 2, fixes: 1, unchanged: 7 }} />)

    const chip = screen.getByRole('group')
    expect(chip).toHaveAccessibleName(/2 regressions, 1 fixes, 7 unchanged/i)
    expect(chip).toHaveTextContent('2')
    expect(chip).toHaveTextContent('1')
    expect(chip).toHaveTextContent('7')
  })

  it('marks regressions with the fail tone only when there are any', () => {
    const { rerender } = render(<RunDeltaChip delta={{ regressions: 0, fixes: 0, unchanged: 3 }} />)
    expect(screen.getByRole('group').querySelector('.text-fail')).toBeNull()

    rerender(<RunDeltaChip delta={{ regressions: 1, fixes: 0, unchanged: 3 }} />)
    expect(screen.getByRole('group').querySelector('.text-fail')).not.toBeNull()
  })
})
