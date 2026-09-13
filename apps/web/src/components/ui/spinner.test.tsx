import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Spinner } from '@/components/ui/spinner'

describe('Spinner', () => {
  it('stays out of the accessibility tree so it never competes with the wait message', () => {
    const { container } = render(<Spinner data-testid="spinner" />)

    expect(screen.getByTestId('spinner')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('reserves a box wide enough for the orbit instead of letting the markers overflow', () => {
    render(<Spinner size="lg" data-testid="spinner" />)

    expect(screen.getByTestId('spinner')).toHaveStyle({ '--spinner-size': '1.25rem' })
  })

  it('renders a centre dot and two orbiting markers', () => {
    const { container } = render(<Spinner />)

    expect(container.querySelectorAll('.spinner-core')).toHaveLength(1)
    expect(container.querySelectorAll('.spinner-marker')).toHaveLength(2)
  })

  it('takes the colour from the call site rather than owning one', () => {
    render(<Spinner className="text-ai" data-testid="spinner" />)

    expect(screen.getByTestId('spinner')).toHaveClass('text-ai')
    expect(screen.getByTestId('spinner')).toHaveClass('spinner')
  })
})
