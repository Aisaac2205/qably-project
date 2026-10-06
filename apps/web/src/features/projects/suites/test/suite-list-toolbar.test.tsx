import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SuiteListToolbar } from '@/features/projects/suites/components/suite-list-toolbar'
import { useSuiteListFilters } from '@/features/projects/suites/hooks/use-suite-list-filters'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [k: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function Harness() {
  const filters = useSuiteListFilters()

  return (
    <>
      <SuiteListToolbar projectId="proj-1" filters={filters} availableTags={[]} />
      <output data-testid="applied">{filters.appliedSearch}</output>
    </>
  )
}

describe('SuiteListToolbar search', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('holds back the debounced search while an IME composition is open', () => {
    render(<Harness />)
    const input = screen.getByTestId('suite-search')

    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'に' } })
    act(() => vi.advanceTimersByTime(1000))

    expect(screen.getByTestId('suite-search')).toHaveValue('に')
    expect(screen.getByTestId('applied')).toBeEmptyDOMElement()
  })

  it('applies the composed text 300 ms after the composition ends', () => {
    render(<Harness />)
    const input = screen.getByTestId('suite-search')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'にほん' } })
    act(() => vi.advanceTimersByTime(1000))

    fireEvent.compositionEnd(input)
    act(() => vi.advanceTimersByTime(299))
    expect(screen.getByTestId('applied')).toBeEmptyDOMElement()

    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByTestId('applied')).toHaveTextContent('にほん')
  })

  it('applies plain typing after the debounce, with no composition involved', () => {
    render(<Harness />)

    fireEvent.change(screen.getByTestId('suite-search'), { target: { value: 'auth' } })
    act(() => vi.advanceTimersByTime(300))

    expect(screen.getByTestId('applied')).toHaveTextContent('auth')
  })
})
