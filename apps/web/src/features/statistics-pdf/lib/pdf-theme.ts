import { Font } from '@react-pdf/renderer'

/**
 * Colour tokens for the statistics PDF.
 *
 * A PDF has no access to CSS custom properties, and react-pdf does not parse
 * OKLCH, so this is the PDF surface's own token file: each value is the sRGB
 * conversion of the matching `apps/web/src/app/globals.css` token. Change the
 * CSS token first, then re-derive the hex here. Components never inline a colour.
 */
export const PDF_COLORS = {
  /** --fg: oklch(0.185 0.004 85) */
  fg: '#131311',
  /** --fg-muted: oklch(0.475 0.008 85) */
  fgMuted: '#5e5c57',
  /** --border: oklch(0.890 0.004 85) */
  border: '#dcdad8',
  /** --border-strong: oklch(0.820 0.006 85) */
  borderStrong: '#c6c4c0',
  /** --bg: oklch(0.970 0.006 260) */
  band: '#f3f5f9',
  /** --heatmap-l0: oklch(0.935 0.008 260) — bar track */
  track: '#e6eaef',
  /** --status-pass: oklch(0.45 0.15 145) — bar fill and "better" change */
  pass: '#006911',
  /** --status-fail: oklch(0.45 0.20 25) — "worse" change */
  fail: '#a9000c',
  /** --bg-surface: oklch(1 0 0) */
  surface: '#ffffff',
} as const

export const PDF_FONT_SANS = 'Geist'
export const PDF_FONT_MONO = 'Geist Mono'

/** Where the Geist TTFs live: served from `public/fonts/geist` in the browser. */
export const DEFAULT_PDF_FONT_BASE = '/fonts/geist'

let registeredBase: string | null = null

/**
 * Registers Geist Sans and Geist Mono (SIL OFL, `public/fonts/geist/LICENSE.txt`)
 * so the PDF uses the product's type stack and renders every Spanish accent.
 * Idempotent per base path.
 */
export function registerStatisticsPdfFonts(base: string = DEFAULT_PDF_FONT_BASE): void {
  if (registeredBase === base) return

  Font.register({
    family: PDF_FONT_SANS,
    fonts: [
      { src: `${base}/Geist-Regular.ttf`, fontWeight: 400 },
      { src: `${base}/Geist-Medium.ttf`, fontWeight: 500 },
      { src: `${base}/Geist-SemiBold.ttf`, fontWeight: 600 },
    ],
  })
  Font.register({
    family: PDF_FONT_MONO,
    fonts: [
      { src: `${base}/GeistMono-Regular.ttf`, fontWeight: 400 },
      { src: `${base}/GeistMono-Medium.ttf`, fontWeight: 500 },
    ],
  })
  // react-pdf hyphenates with English rules by default, which splits Spanish
  // words in the wrong places. Whole words wrap instead.
  Font.registerHyphenationCallback((word) => [word])

  registeredBase = base
}
