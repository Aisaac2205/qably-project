import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DeliveryBars } from '../delivery-bars'

const points = Array.from({ length: 14 }, (_, index) => ({
  date: `2026-09-${String(index + 1).padStart(2, '0')}`,
  sent: index === 3 ? 0 : 5 + index,
  failed: index === 5 ? 2 : 0,
}))

describe('DeliveryBars', () => {
  it('renders one bar per day', () => {
    const { container } = render(<DeliveryBars points={points} label="Deliveries, last 14 days" />)

    expect(container.querySelectorAll('[data-slot="delivery-bar"]')).toHaveLength(14)
  })

  it('tints a day with failures using the fail tone', () => {
    const { container } = render(<DeliveryBars points={points} label="Deliveries, last 14 days" />)

    const bars = container.querySelectorAll('[data-slot="delivery-bar"]')
    expect(bars[5]).toHaveClass('bg-qb-fail')
  })

  it('tints a day with sends and no failures using the ink tone, never the pass/green semantic tone', () => {
    const { container } = render(<DeliveryBars points={points} label="Deliveries, last 14 days" />)

    const bars = container.querySelectorAll('[data-slot="delivery-bar"]')
    expect(bars[0]).toHaveClass('bg-qb-fg')
    expect(bars[0]).not.toHaveClass('bg-qb-pass')
  })

  it('scales each bar height proportionally to that day\'s sent count, capped at 26px, with a visible floor for zero days', () => {
    const { container } = render(<DeliveryBars points={points} label="Deliveries, last 14 days" />)

    const bars = container.querySelectorAll('[data-slot="delivery-bar"]')
    const heights = [...bars].map((bar) => Number((bar as HTMLElement).style.height.replace('px', '')))

    const zeroSendHeight = heights[3] ?? 0
    const lastHeight = heights.at(-1) ?? 0

    expect(Math.max(...heights)).toBeLessThanOrEqual(26)
    expect(zeroSendHeight).toBeGreaterThanOrEqual(3)
    expect(zeroSendHeight).toBeLessThan(lastHeight)
  })

  it('renders a muted empty bar for a day with zero sends and zero failures', () => {
    const { container } = render(<DeliveryBars points={points} label="Deliveries, last 14 days" />)

    const bars = container.querySelectorAll('[data-slot="delivery-bar"]')
    expect(bars[3]).toHaveClass('bg-qb-border')
  })

  it('mirrors the series in an sr-only table', () => {
    render(<DeliveryBars points={points} label="Deliveries, last 14 days" />)

    const table = screen.getByRole('table')
    expect(table).toHaveClass('sr-only')
    expect(within(table).getAllByRole('row')).toHaveLength(15)
  })

  it('renders an empty state message when there are no points', () => {
    render(<DeliveryBars points={[]} label="Deliveries" emptyLabel="No delivery data" />)

    expect(screen.getByText('No delivery data')).toBeInTheDocument()
  })

  describe('tooltip date', () => {
    function hoverDay(
      day: string,
      props: { locale?: string } = {},
    ): HTMLElement {
      const { container } = render(
        <DeliveryBars
          points={[{ date: day, sent: 3, failed: 0 }]}
          label="Deliveries"
          {...props}
        />,
      )
      fireEvent.mouseEnter(container.querySelector('[data-slot="delivery-bar"]') as Element)
      return screen.getByRole('tooltip')
    }

    afterEach(() => {
      document.documentElement.lang = ''
    })

    it('writes the month in the locale it is given', () => {
      expect(hoverDay('2026-09-04', { locale: 'en' })).toHaveTextContent('Sep 4')
    })

    it('writes the month in Spanish for a Spanish locale', () => {
      expect(hoverDay('2026-09-04', { locale: 'es' })).toHaveTextContent(/4 sep/i)
    })

    it('follows the language of the page when no locale is passed', () => {
      document.documentElement.lang = 'es'

      expect(hoverDay('2026-09-04')).toHaveTextContent(/4 sep/i)
    })

    it('does not shift a date-only string to the neighbouring day', () => {
      expect(hoverDay('2026-09-01', { locale: 'en' })).toHaveTextContent('Sep 1')
      cleanup()
      expect(hoverDay('2026-12-31', { locale: 'en' })).toHaveTextContent('Dec 31')
    })

    it('shows a date it cannot read exactly as it came', () => {
      expect(hoverDay('last week', { locale: 'en' })).toHaveTextContent('last week')
      cleanup()
      expect(hoverDay('2026-02-31', { locale: 'en' })).toHaveTextContent('2026-02-31')
    })

    it('falls back to the default locale instead of throwing on a malformed one', () => {
      expect(hoverDay('2026-09-04', { locale: 'not a locale' })).toHaveTextContent(/4/)
    })
  })
})
