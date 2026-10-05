import { useRef } from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollRestoration } from './use-scroll-restoration'

let mockPathname = '/projects/p1/suites'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

const CLIENT_HEIGHT = 600

function Harness() {
  const ref = useRef<HTMLElement>(null)
  useScrollRestoration(ref)

  return (
    <main ref={ref} data-testid="main">
      content
    </main>
  )
}

interface Layout {
  contentHeight: number
}

function stubLayout(element: HTMLElement, layout: Layout) {
  let top = 0

  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => CLIENT_HEIGHT,
  })
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => layout.contentHeight,
  })
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, layout.contentHeight - CLIENT_HEIGHT))
    },
  })
  element.scrollTo = vi.fn((options?: ScrollToOptions | number) => {
    if (typeof options === 'object' && options.top !== undefined) element.scrollTop = options.top
  }) as unknown as typeof element.scrollTo
}

function setup(path = '/projects/p1/suites', contentHeight = 3000) {
  mockPathname = path.split('?')[0]
  window.history.replaceState({}, '', path)
  const view = render(<Harness />)
  const main = view.getByTestId('main')
  const layout: Layout = { contentHeight }
  stubLayout(main, layout)

  function scrollTo(top: number) {
    main.scrollTop = top
    main.dispatchEvent(new Event('scroll'))
  }

  function push(path: string, nextContentHeight: number) {
    window.history.pushState({}, '', path)
    mockPathname = path.split('?')[0]
    layout.contentHeight = nextContentHeight
    main.scrollTop = 0
    view.rerender(<Harness />)
  }

  function traverse(path: string, nextContentHeight: number, commit = true) {
    window.history.replaceState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
    layout.contentHeight = nextContentHeight
    if (commit) {
      mockPathname = path.split('?')[0]
      view.rerender(<Harness />)
    }
  }

  function commit(path: string) {
    mockPathname = path.split('?')[0]
    view.rerender(<Harness />)
  }

  function advance(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  }

  return { view, main, layout, scrollTo, push, traverse, commit, advance }
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'Date',
    ],
  })
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState({}, '', '/')
})

describe('useScrollRestoration', () => {
  it('restores the saved position when going back to a list, jumping instead of animating', () => {
    const page = setup('/projects/p1/suites', 3000)
    page.scrollTo(800)
    page.push('/projects/p1/suites/s1', 1500)

    page.traverse('/projects/p1/suites', 3000)
    page.advance(100)

    expect(page.main.scrollTop).toBe(800)
    expect(page.main.scrollTo).toHaveBeenCalledWith({ top: 800, behavior: 'instant' })
  })

  it('does not restore on a push navigation, which starts at the top', () => {
    const page = setup('/projects/p1/suites', 3000)
    page.scrollTo(800)
    page.push('/projects/p1/suites/s1', 1500)

    page.push('/projects/p1/suites', 3000)
    page.advance(2000)

    expect(page.main.scrollTop).toBe(0)
    expect(page.main.scrollTo).not.toHaveBeenCalled()
  })

  it('keeps the saved position of the list while the outgoing page is still on screen', () => {
    const page = setup('/projects/p1/suites', 3000)
    page.scrollTo(800)
    page.push('/projects/p1/suites/s1', 2500)
    page.scrollTo(300)

    page.traverse('/projects/p1/suites', 3000, false)
    page.scrollTo(300)
    page.commit('/projects/p1/suites')
    page.advance(100)
    expect(page.main.scrollTop).toBe(800)

    page.push('/projects/p1/suites/s1', 2500)
    page.traverse('/projects/p1/suites', 3000)
    page.advance(100)

    expect(page.main.scrollTop).toBe(800)
  })

  it('waits for content that grows late before restoring', () => {
    const page = setup('/projects/p1/suites', 3000)
    page.scrollTo(800)
    page.push('/projects/p1/suites/s1', 1500)

    page.traverse('/projects/p1/suites', 600)
    page.advance(600)
    expect(page.main.scrollTop).toBe(0)

    page.layout.contentHeight = 3000
    page.advance(100)

    expect(page.main.scrollTop).toBe(800)
  })

  it('gives up after about a second and a half, so later growth never scrolls the user', () => {
    const page = setup('/projects/p1/suites', 3000)
    page.scrollTo(800)
    page.push('/projects/p1/suites/s1', 1500)

    page.traverse('/projects/p1/suites', 600)
    page.advance(2000)
    page.layout.contentHeight = 3000
    page.advance(500)

    expect(page.main.scrollTop).toBe(0)
  })

  it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])(
    'aborts the restoration as soon as the user interacts with a %s',
    (type) => {
      const page = setup('/projects/p1/suites', 3000)
      page.scrollTo(800)
      page.push('/projects/p1/suites/s1', 1500)
      page.traverse('/projects/p1/suites', 600)
      page.advance(200)

      window.dispatchEvent(new Event(type))
      page.layout.contentHeight = 3000
      page.advance(500)

      expect(page.main.scrollTop).toBe(0)
    },
  )

  it('keeps enforcing the position while the outgoing page is swapped for the list', () => {
    const page = setup('/projects/p1/suites', 3000)
    page.scrollTo(800)
    page.push('/projects/p1/suites/s1', 2500)

    page.traverse('/projects/p1/suites', 3000)
    page.advance(32)
    expect(page.main.scrollTop).toBe(800)
    page.main.scrollTop = 0
    page.advance(100)

    expect(page.main.scrollTop).toBe(800)
  })

  it('restores the entry of the same path that matches the search params', () => {
    const page = setup('/projects/p1/runs?tab=ci', 3000)
    page.scrollTo(300)
    window.history.pushState({}, '', '/projects/p1/runs?tab=manual')
    page.main.scrollTop = 0
    page.scrollTo(900)

    page.traverse('/projects/p1/runs?tab=ci', 3000)
    page.advance(100)

    expect(page.main.scrollTop).toBe(300)
  })

  it('goes back to the top for an entry that was never scrolled', () => {
    const page = setup('/projects/p1/suites', 3000)
    page.push('/projects/p1/suites/s1', 2500)
    page.scrollTo(300)

    page.traverse('/projects/p1/suites', 3000)
    page.advance(100)

    expect(page.main.scrollTop).toBe(0)
  })

  it('stops restoring when the user navigates forward again before it finishes', () => {
    const page = setup('/projects/p1/suites', 3000)
    page.scrollTo(800)
    page.push('/projects/p1/suites/s1', 1500)
    page.traverse('/projects/p1/suites', 600)
    page.advance(200)

    page.push('/projects/p1/runs', 600)
    page.layout.contentHeight = 3000
    page.advance(500)

    expect(page.main.scrollTop).toBe(0)
  })

  it('leaves hash navigations to the browser', () => {
    const page = setup('/projects/p1/suites', 3000)
    page.scrollTo(800)
    page.push('/projects/p1/suites/s1', 1500)

    page.traverse('/projects/p1/suites#top', 3000)
    page.advance(100)

    expect(page.main.scrollTo).not.toHaveBeenCalled()
  })

  it('stops listening once the shell unmounts', () => {
    const page = setup('/projects/p1/suites', 3000)
    page.scrollTo(800)
    page.push('/projects/p1/suites/s1', 1500)
    page.view.unmount()

    window.history.replaceState({}, '', '/projects/p1/suites')
    window.dispatchEvent(new PopStateEvent('popstate'))
    page.layout.contentHeight = 3000
    page.advance(500)

    expect(page.main.scrollTo).not.toHaveBeenCalled()
  })
})
