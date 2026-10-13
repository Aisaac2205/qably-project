// @vitest-environment node
import path from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it, vi } from 'vitest'
import { en, es } from '@qably/i18n'
import { dashboardOverviewFixture } from '@/test/dashboard-api-stub'
import { buildStatisticsReport, type Translate } from '@/features/statistics-pdf/lib/build-statistics-report'
import { registerStatisticsPdfFonts } from '@/features/statistics-pdf/lib/pdf-theme'
import { StatisticsReportDocument } from '@/features/statistics-pdf/components/statistics-report-document'

// react-pdf drives its own reconciler, outside React DOM's act() contract.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false

const FONT_DIR = path.resolve(__dirname, '../../../../public/fonts/geist')

// The shared setup clears localStorage around every test; the node
// environment this smoke test needs has none, so it gets an in-memory one.
if (typeof globalThis.localStorage === 'undefined') {
  const entries = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
  })
}

function translator(dictionary: Record<string, unknown>): Translate {
  return (key, params) => {
    const count = params?.count
    const lookup = (candidate: string) =>
      candidate.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dictionary)
    const plural = typeof count === 'number' ? lookup(`${key}${count === 1 ? '_one' : '_other'}`) : undefined
    const template = typeof plural === 'string' ? plural : lookup(key)
    if (typeof template !== 'string') return key
    return Object.entries(params ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
      template,
    )
  }
}

describe('StatisticsReportDocument', () => {
  registerStatisticsPdfFonts(FONT_DIR)

  it.each([
    ['en', en],
    ['es', es],
  ] as const)('renders a real PDF with the Geist fonts embedded (%s)', async (locale, dictionary) => {
    const report = buildStatisticsReport(dashboardOverviewFixture, {
      scope: 'organization',
      period: 30,
      generatedAt: new Date('2026-06-17T15:30:00.000Z'),
      locale,
      t: translator(dictionary as Record<string, unknown>),
    })

    const buffer = await renderToBuffer(<StatisticsReportDocument report={report} />)
    const raw = buffer.toString('latin1')

    expect(raw.startsWith('%PDF')).toBe(true)
    expect(raw).toMatch(/\/BaseFont \/[A-Z]{6}\+Geist-Regular/)
    expect(raw).toMatch(/\/BaseFont \/[A-Z]{6}\+GeistMono-Regular/)
    expect(raw).not.toContain('/Helvetica')
  }, 30_000)
})
