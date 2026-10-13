import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ChangeTone, ReportCountRow, StatisticsReport } from '../lib/build-statistics-report'
import { PDF_COLORS, PDF_FONT_MONO, PDF_FONT_SANS } from '../lib/pdf-theme'

/*
 * A4 portrait (595 × 842 pt). Sizes are in points, the unit of the page.
 * Labels set in Geist Sans, every number in Geist Mono so columns align.
 * lineHeight is set per text style, never on the Page: in @react-pdf/renderer
 * 4.9.0 an inherited lineHeight blanks out dynamic (`render`) text such as
 * the page number.
 */
const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: PDF_FONT_SANS,
    fontSize: 9,
    color: PDF_COLORS.fg,
    backgroundColor: PDF_COLORS.surface,
  },
  header: { marginBottom: 22 },
  title: { fontSize: 18, fontWeight: 600, lineHeight: 1.2, letterSpacing: -0.2, marginBottom: 14 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: PDF_COLORS.border },
  metaItem: { width: '50%', paddingTop: 9, paddingRight: 12 },
  metaLabel: { fontSize: 7.5, color: PDF_COLORS.fgMuted, marginBottom: 2 },
  metaValue: { fontSize: 9.5, fontWeight: 500 },
  section: { marginTop: 20 },
  sectionHeading: { fontSize: 11, fontWeight: 600, marginBottom: 2 },
  sectionDescription: { fontSize: 8, lineHeight: 1.4, color: PDF_COLORS.fgMuted, marginBottom: 6 },
  sectionHeadingGap: { marginBottom: 8 },
  table: { borderTopWidth: 1, borderTopColor: PDF_COLORS.borderStrong },
  headRow: {
    flexDirection: 'row',
    backgroundColor: PDF_COLORS.band,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.borderStrong,
  },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: PDF_COLORS.border },
  headCell: { paddingVertical: 5, paddingHorizontal: 6, fontSize: 7.5, fontWeight: 500, color: PDF_COLORS.fgMuted },
  cell: { paddingVertical: 5, paddingHorizontal: 6 },
  numeric: { textAlign: 'right' },
  mono: { fontFamily: PDF_FONT_MONO },
  muted: { color: PDF_COLORS.fgMuted },
  better: { color: PDF_COLORS.pass },
  worse: { color: PDF_COLORS.fail },
  barCell: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 6 },
  barTrack: { flexGrow: 1, height: 6, borderRadius: 3, backgroundColor: PDF_COLORS.track, marginRight: 8 },
  barFill: { height: 6, borderRadius: 3, backgroundColor: PDF_COLORS.pass },
  barValue: { width: 72, textAlign: 'right' },
  empty: { paddingVertical: 10, color: PDF_COLORS.fgMuted },
  columns: { flexDirection: 'row', marginTop: 20 },
  column: { flexGrow: 1, flexBasis: 0 },
  columnGap: { width: 20 },
  summary: { marginTop: 6, fontSize: 8.5, lineHeight: 1.4 },
  notes: { marginTop: 22, paddingTop: 8, borderTopWidth: 1, borderTopColor: PDF_COLORS.border },
  note: { fontSize: 7.5, lineHeight: 1.4, color: PDF_COLORS.fgMuted, marginBottom: 2 },
  footerText: { position: 'absolute', bottom: 24, left: 44, fontSize: 7.5, color: PDF_COLORS.fgMuted },
  pageNumber: {
    position: 'absolute',
    bottom: 24,
    left: 44,
    right: 44,
    textAlign: 'right',
    fontSize: 7.5,
    color: PDF_COLORS.fgMuted,
  },
})

/** Numbers, signed changes and durations set in Geist Mono; words such as "Not measured" stay in Geist Sans. */
function numberFont(value: string) {
  return /^[+-]?\d/.test(value) ? styles.mono : {}
}

const TONE_STYLE: Record<ChangeTone, { color?: string }> = {
  better: styles.better,
  worse: styles.worse,
  neutral: {},
}

interface Column {
  readonly width: string
  readonly numeric?: boolean
}

function HeadRow({ labels, columns }: { labels: readonly string[]; columns: readonly Column[] }) {
  return (
    <View style={styles.headRow} fixed>
      {labels.map((label, index) => (
        <Text
          key={label}
          style={[styles.headCell, { width: columns[index]?.width }, columns[index]?.numeric ? { textAlign: 'right' } : {}]}
        >
          {label}
        </Text>
      ))}
    </View>
  )
}

function SectionHeading({ heading, description }: { heading: string; description?: string }) {
  return (
    <View minPresenceAhead={60}>
      <Text style={[styles.sectionHeading, description ? {} : styles.sectionHeadingGap]}>{heading}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
  )
}

const KPI_COLUMNS: readonly Column[] = [
  { width: '37%' },
  { width: '21%', numeric: true },
  { width: '21%', numeric: true },
  { width: '21%', numeric: true },
]

const TREND_COLUMNS: readonly Column[] = [
  { width: '14%' },
  { width: '42%', numeric: true },
  { width: '18%', numeric: true },
  { width: '13%', numeric: true },
  { width: '13%', numeric: true },
]

const COUNT_COLUMNS: readonly Column[] = [{ width: '50%' }, { width: '25%', numeric: true }, { width: '25%', numeric: true }]

const PROJECT_COLUMNS: readonly Column[] = [
  { width: '34%' },
  { width: '12%', numeric: true },
  { width: '12%', numeric: true },
  { width: '17%', numeric: true },
  { width: '25%', numeric: true },
]

function CountTable({ columns, rows }: { columns: readonly string[]; rows: readonly ReportCountRow[] }) {
  return (
    <View style={styles.table}>
      <HeadRow labels={columns} columns={COUNT_COLUMNS} />
      {rows.map((row) => (
        <View key={row.label} style={styles.row} wrap={false}>
          <Text style={[styles.cell, { width: '50%' }]}>{row.label}</Text>
          <Text style={[styles.cell, styles.numeric, numberFont(row.count), { width: '25%' }]}>{row.count}</Text>
          <Text style={[styles.cell, styles.numeric, numberFont(row.share), styles.muted, { width: '25%' }]}>{row.share}</Text>
        </View>
      ))}
    </View>
  )
}

export function StatisticsReportDocument({ report }: { report: StatisticsReport }) {
  return (
    <Document
      title={report.title}
      author="Qably"
      creator="Qably"
      producer="Qably"
      subject={report.meta.map((entry) => `${entry.label}: ${entry.value}`).join(' · ')}
      language={report.language}
    >
      <Page size="A4" orientation="portrait" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.title}>{report.title}</Text>
          <View style={styles.metaGrid}>
            {report.meta.map((entry) => (
              <View key={entry.label} style={styles.metaItem}>
                <Text style={styles.metaLabel}>{entry.label}</Text>
                <Text style={styles.metaValue}>{entry.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View>
          <SectionHeading heading={report.kpis.heading} />
          <View style={styles.table}>
            <HeadRow labels={report.kpis.columns} columns={KPI_COLUMNS} />
            {report.kpis.rows.map((row) => (
              <View key={row.label} style={styles.row} wrap={false}>
                <Text style={[styles.cell, { width: '37%' }]}>{row.label}</Text>
                <Text style={[styles.cell, styles.numeric, numberFont(row.current), { width: '21%', fontWeight: 500 }]}>{row.current}</Text>
                <Text style={[styles.cell, styles.numeric, numberFont(row.previous), styles.muted, { width: '21%' }]}>{row.previous}</Text>
                <Text style={[styles.cell, styles.numeric, numberFont(row.change), { width: '21%' }, TONE_STYLE[row.tone]]}>
                  {row.change}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading heading={report.trend.heading} />
          {report.trend.emptyText ? (
            <Text style={styles.empty}>{report.trend.emptyText}</Text>
          ) : (
            <View style={styles.table}>
              <HeadRow labels={report.trend.columns} columns={TREND_COLUMNS} />
              {report.trend.rows.map((row, index) => (
                <View key={`${row.label}-${index}`} style={styles.row} wrap={false}>
                  <Text style={[styles.cell, { width: '14%' }]}>{row.label}</Text>
                  <View style={[styles.barCell, { width: '42%' }]}>
                    <View style={styles.barTrack}>
                      {row.ratio === null ? null : (
                        <View style={[styles.barFill, { width: `${Math.round(Math.min(Math.max(row.ratio, 0), 1) * 100)}%` }]} />
                      )}
                    </View>
                    <Text style={[styles.barValue, numberFont(row.passRate), row.ratio === null ? styles.muted : {}]}>
                      {row.passRate}
                    </Text>
                  </View>
                  <Text style={[styles.cell, styles.numeric, numberFont(row.previous), styles.muted, { width: '18%' }]}>{row.previous}</Text>
                  <Text style={[styles.cell, styles.numeric, numberFont(row.executed), { width: '13%' }]}>{row.executed}</Text>
                  <Text style={[styles.cell, styles.numeric, numberFont(row.failed), { width: '13%' }]}>{row.failed}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.columns} wrap={false}>
          <View style={styles.column}>
            <SectionHeading heading={report.cases.heading} description={report.cases.description} />
            <CountTable columns={report.cases.columns} rows={report.cases.rows} />
            <Text style={styles.summary}>{report.cases.summary}</Text>
          </View>
          <View style={styles.columnGap} />
          <View style={styles.column}>
            <SectionHeading heading={report.priorities.heading} description={report.priorities.description} />
            <CountTable columns={report.priorities.columns} rows={report.priorities.rows} />
          </View>
        </View>

        {report.projects ? (
          <View style={styles.section}>
            <SectionHeading heading={report.projects.heading} />
            <View style={styles.table}>
              <HeadRow labels={report.projects.columns} columns={PROJECT_COLUMNS} />
              {report.projects.rows.map((row, index) => (
                <View key={`${row.name}-${index}`} style={styles.row} wrap={false}>
                  <Text style={[styles.cell, { width: '34%' }]}>{row.name}</Text>
                  <Text style={[styles.cell, styles.numeric, numberFont(row.suites), { width: '12%' }]}>{row.suites}</Text>
                  <Text style={[styles.cell, styles.numeric, numberFont(row.cases), { width: '12%' }]}>{row.cases}</Text>
                  <Text style={[styles.cell, styles.numeric, numberFont(row.passRate), { width: '17%' }]}>{row.passRate}</Text>
                  <Text style={[styles.cell, styles.numeric, styles.muted, { width: '25%' }]}>{row.lastRun}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.notes} wrap={false}>
          {report.notes.map((note) => (
            <Text key={note} style={styles.note}>
              {note}
            </Text>
          ))}
        </View>

        <Text style={styles.footerText} fixed>
          {report.footer}
        </Text>
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) =>
            report.pageLabel.replace('{page}', String(pageNumber)).replace('{total}', String(totalPages))
          }
        />
      </Page>
    </Document>
  )
}
