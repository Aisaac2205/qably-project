import { pdf } from '@react-pdf/renderer'
import { StatisticsReportDocument } from '../components/statistics-report-document'
import type { StatisticsReport } from './build-statistics-report'
import { registerStatisticsPdfFonts } from './pdf-theme'

/**
 * Renders the statistics report to a PDF blob in the browser.
 *
 * This module is the only entry point to `@react-pdf/renderer` and is loaded
 * with a dynamic `import()` when someone asks for the PDF, so the renderer
 * never enters the initial page bundle.
 */
export async function renderStatisticsPdf(report: StatisticsReport): Promise<Blob> {
  registerStatisticsPdfFonts()
  return pdf(<StatisticsReportDocument report={report} />).toBlob()
}
