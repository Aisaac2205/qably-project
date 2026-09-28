import '@testing-library/jest-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { useI18nStore } from '@/lib/i18n/store'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true

vi.mock('next/navigation', () => {
  const router = {
    back: () => {},
    forward: () => {},
    prefetch: () => Promise.resolve(),
    push: () => {},
    refresh: () => {},
    replace: () => {},
  }

  return {
    useParams: () => ({}),
    usePathname: () => '/dashboard',
    useRouter: () => router,
    useSearchParams: () => new URLSearchParams(),
  }
})

beforeEach(() => {
  localStorage.clear()
  useI18nStore.setState({ locale: 'en' })
})

afterEach(() => {
  localStorage.clear()
  useI18nStore.setState({ locale: 'en' })
})

// Polyfill ResizeObserver for jsdom (needed by Recharts and by @visx/responsive's
// ParentSize, which the @qably/ui/charts bklit components use). jsdom never does
// real layout, so `observe` reports a fixed synthetic content box asynchronously
// instead of the real (always-zero) bounding rect — without this, ParentSize's
// width/height stay 0 forever and bklit charts never mount past their `width < 10`
// bail-out guard.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe(target: Element) {
      const contentRect = {
        width: 640,
        height: 240,
        top: 0,
        left: 0,
        bottom: 240,
        right: 640,
        x: 0,
        y: 0,
        toJSON() {
          return this
        },
      }
      queueMicrotask(() => {
        this.callback(
          [{ target, contentRect } as unknown as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        )
      })
    }

    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

// jsdom (29.x) has no per-tag SVG interfaces beyond defs/desc/g/metadata/svg/
// switch/symbol/title — every other SVG tag (path, line, rect, circle, ...)
// is instantiated as a plain SVGElement (see jsdom's living/helpers/
// create-element.js `getSVGInterface`), so there is no SVGPathElement or
// SVGGeometryElement in this environment's prototype chain at all. Patch the
// actual base class instead: @qably/ui/charts calls getTotalLength/
// getPointAtLength unconditionally once a path mounts (dash-tail overlays,
// hover highlight segments), and without these stubs every chart with 2+
// data points throws "path.getTotalLength is not a function" the moment its
// measurement effect runs. Zero-length/zero-point results are inert,
// matching this codebase's own "no path yet" fallback.
if (typeof SVGElement !== 'undefined') {
  const svgElementPrototype = SVGElement.prototype as unknown as SVGGeometryElement
  if (typeof svgElementPrototype.getTotalLength !== 'function') {
    svgElementPrototype.getTotalLength = () => 0
  }
  if (typeof svgElementPrototype.getPointAtLength !== 'function') {
    svgElementPrototype.getPointAtLength = () => ({ x: 0, y: 0 }) as DOMPoint
  }
}
