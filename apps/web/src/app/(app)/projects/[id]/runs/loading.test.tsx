import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useI18nStore } from '@/lib/i18n/store'
import { focusableElements } from '@/features/runs/test/focus-ring'
import RunsLoading from './loading'

function renderLoading() {
  return render(<RunsLoading />)
}

function tabsStrip(container: HTMLElement): HTMLElement {
  const strip = container.querySelector<HTMLElement>('.border-b.border-border')

  expect(strip).not.toBeNull()

  return strip as HTMLElement
}

function flushList(container: HTMLElement): HTMLElement {
  const list = container.querySelector<HTMLElement>('.rule-bleed')

  expect(list).not.toBeNull()

  return list as HTMLElement
}

describe('the runs loading skeleton', () => {
  describe('what it announces', () => {
    it('marks the page busy and announces the loading state once, to screen readers only', () => {
      const { container } = renderLoading()

      const status = screen.getByRole('status')
      expect(screen.getAllByRole('status')).toHaveLength(1)
      expect(status).toHaveClass('sr-only')
      expect(status).toHaveTextContent('Loading runs…')
      expect(container.querySelector('[aria-busy="true"]')).toContainElement(status)
    })

    it('announces it in Spanish when the locale is Spanish', () => {
      useI18nStore.setState({ locale: 'es' })

      renderLoading()

      expect(screen.getByRole('status')).toHaveTextContent('Cargando corridas…')
    })

    it('has no heading while loading, like the other loading screens', () => {
      renderLoading()

      expect(screen.queryAllByRole('heading')).toHaveLength(0)
    })

    it('offers nothing to focus', () => {
      const { container } = renderLoading()

      expect(focusableElements(container)).toHaveLength(0)
      expect(screen.queryAllByRole('tab')).toHaveLength(0)
    })
  })

  describe('what it mirrors of the tabbed page', () => {
    it('draws the strip of the two tabs above the list', () => {
      const { container } = renderLoading()
      const strip = tabsStrip(container)

      expect(strip.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2)
      expect(
        strip.compareDocumentPosition(flushList(container)) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })

    it('gives each tab placeholder the touch height of a real tab', () => {
      const { container } = renderLoading()

      for (const tab of Array.from(tabsStrip(container).children)) {
        expect(tab).toHaveClass('min-h-11', 'md:min-h-10')
      }
    })

    it('draws a flush list with rules above, below and between the rows, like the real one', () => {
      const { container } = renderLoading()
      const list = flushList(container)

      expect(list).toHaveClass('border-y', 'border-border')
      expect(list.querySelector('.divide-y')).not.toBeNull()
    })

    it('draws five rows, each with a chip and lines of text', () => {
      const { container } = renderLoading()
      const rows = Array.from(flushList(container).querySelector('.divide-y')?.children ?? [])

      expect(rows).toHaveLength(5)
      for (const row of rows) {
        expect(row.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(3)
      }
    })

    it('has no title or action placeholder and no rounded card rows', () => {
      const { container } = renderLoading()

      expect(container.querySelector('[class*="rounded-xl"]')).toBeNull()
      expect(container.querySelector('[data-slot="card"]')).toBeNull()
      expect(container.querySelector('.justify-between')).toBeNull()
    })
  })

  describe('what it is made of', () => {
    it('uses the skeleton primitive for every placeholder and no loader of its own', () => {
      const { container } = renderLoading()

      const pulsing = container.querySelectorAll('.animate-pulse')
      const skeletons = container.querySelectorAll('[data-slot="skeleton"]')

      expect(skeletons.length).toBeGreaterThan(0)
      expect(pulsing).toHaveLength(skeletons.length)
      expect(container.querySelector('.animate-spin')).toBeNull()
    })

    it('keeps the horizontal padding of the page it stands in for', () => {
      const { container } = renderLoading()

      expect(container.firstElementChild).toHaveClass('px-5', 'sm:px-7', 'lg:px-9')
    })
  })
})
