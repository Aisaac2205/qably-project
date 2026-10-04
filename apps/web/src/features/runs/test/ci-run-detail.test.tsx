import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CiRunJobRunRecord, CiRunSummaryRecord } from '@qably/types'
import { CiRunDetail } from '@/features/runs/components/ci-run-detail'
import { PROJECT, ciRunDetail, ciRunJobRun } from './ci-run-fixtures'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function renderDetail(runs: CiRunJobRunRecord[], overrides: Partial<CiRunSummaryRecord> = {}) {
  return render(<CiRunDetail projectId={PROJECT} ciRun={ciRunDetail(runs, overrides)} />)
}

function job(
  jobKey: string,
  id: string,
  overrides: Partial<CiRunJobRunRecord> = {},
): CiRunJobRunRecord {
  return ciRunJobRun(id, { ciJobKey: jobKey, suiteName: `${jobKey} ${id}`, ...overrides })
}

function headings(): string[] {
  return screen.queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent ?? '')
}

function precedes(first: HTMLElement, second: HTMLElement): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('CiRunDetail', () => {
  it('shows the header of the run above its suites', () => {
    renderDetail([job('api', 'a', { status: 'fail' })])

    const title = screen.getByRole('heading', { level: 2, name: 'Fix flaky checkout' })
    expect(precedes(title, screen.getByRole('heading', { level: 3, name: 'api' }))).toBe(true)
    expect(screen.getByText('Has failures')).toBeInTheDocument()
  })

  it('groups the suites by job, with the failing jobs first and then alphabetically', () => {
    renderDetail([
      job('web', 'w1'),
      job('landing', 'l1'),
      job('api', 'a1', { status: 'fail' }),
      job('Zeta', 'z1', { status: 'fail' }),
      job('docs', 'd1'),
    ])

    expect(headings()).toEqual(['api', 'Zeta', 'docs', 'landing', 'web'])
  })

  it('lists the suites straight under the header when no suite belongs to a job', () => {
    renderDetail([
      ciRunJobRun('a', { status: 'fail', suiteName: 'Alpha' }),
      ciRunJobRun('b', { status: 'fail', suiteName: 'Beta' }),
      ciRunJobRun('c', { suiteName: 'Gamma' }),
    ])

    expect(headings()).toEqual([])
    const suites = within(screen.getByRole('list', { name: 'Suites in the run' }))
    expect(suites.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Show 1 suite without failures' })).toBeInTheDocument()
  })

  it('puts the suites without a job first and without a heading, ahead of the jobs', () => {
    renderDetail([
      job('web', 'w1', { status: 'fail' }),
      ciRunJobRun('loose', { status: 'fail', suiteName: 'Loose suite' }),
      job('api', 'a1', { status: 'fail' }),
    ])

    const loose = screen.getByRole('link', { name: /Loose suite/ })
    expect(precedes(loose, screen.getByRole('heading', { name: 'api' }))).toBe(true)
    expect(precedes(loose, screen.getByRole('heading', { name: 'web' }))).toBe(true)
    expect(headings()).toEqual(['api', 'web'])
    const looseList = loose.closest('ul') as HTMLElement
    expect(looseList).toHaveAccessibleName('Suites in the run')
    expect(precedes(screen.getByRole('heading', { level: 2 }), looseList)).toBe(true)
    expect(screen.getAllByRole('heading').filter((heading) => precedes(heading, looseList))).toHaveLength(1)
  })

  it('puts a single disclosure for passing suites without a job before the first heading', () => {
    renderDetail([
      ciRunJobRun('p1'),
      ciRunJobRun('p2'),
      ciRunJobRun('p3'),
      job('api', 'a1', { status: 'fail' }),
    ])

    const disclosure = screen.getByRole('button', { name: 'Show 3 suites without failures' })
    expect(precedes(disclosure, screen.getByRole('heading', { level: 3, name: 'api' }))).toBe(true)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('never invents a job name for suites that carry a blank job key', () => {
    renderDetail([
      ciRunJobRun('a', { status: 'fail', ciJobKey: '   ' }),
      ciRunJobRun('b', { ciJobKey: '' }),
      job('api', 'c', { status: 'fail' }),
    ])

    expect(headings()).toEqual(['api'])
    expect(document.body).not.toHaveTextContent(/unknown/i)
  })

  it('names every list of suites', () => {
    renderDetail([
      ciRunJobRun('a', { status: 'fail' }),
      job('api', 'b', { status: 'fail' }),
      job('build-and-test', 'c', { status: 'fail' }),
    ])

    const names = screen.getAllByRole('list').map((list) => list.getAttribute('aria-label'))
    expect(names).toEqual(['Suites in the run', 'api suites', 'build and test suites'])
  })

  it('decides the report labels for each job on its own', () => {
    renderDetail([
      job('api', 'a1', { status: 'fail', reportExternalId: 'gha-900-api-junit-unit-xml-ab12cd34' }),
      job('api', 'a2', { status: 'fail', reportExternalId: 'gha-900-api-junit-e2e-xml-ef56ab78' }),
      job('web', 'w1', { status: 'fail', reportExternalId: 'gha-900-web-junit-xml-cd34ef56' }),
    ])

    expect(screen.getByText('junit-unit-xml')).toBeInTheDocument()
    expect(screen.getByText('junit-e2e-xml')).toBeInTheDocument()
    expect(screen.queryByText('junit-xml')).not.toBeInTheDocument()
  })

  it('links every suite to its own run in the project of the page', () => {
    renderDetail([job('api', 'a1', { status: 'fail' }), ciRunJobRun('loose', { status: 'fail' })])

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/projects/proj-1/runs/a1')
    expect(hrefs).toContain('/projects/proj-1/runs/loose')
  })

  it('renders the header alone for a run that has no suites yet', () => {
    renderDetail([])

    expect(screen.getByRole('heading', { level: 2, name: 'Fix flaky checkout' })).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(headings()).toEqual([])
  })

  it('keeps the suites of a hundreds-strong job out of the document until asked', () => {
    const passing = Array.from({ length: 300 }, (_, index) => job('api', `p${index}`))
    renderDetail([job('api', 'f1', { status: 'fail' }), job('api', 'f2', { status: 'fail' }), ...passing])

    expect(within(screen.getByRole('list', { name: 'api suites' })).getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Show 300 suites without failures' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})
