import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CiRunJobRunRecord } from '@qably/types'
import { CiRunJobGroup } from '@/features/runs/components/ci-run-job-group'
import { useI18nStore } from '@/lib/i18n/store'
import { PROJECT, ciRunJobRun } from './ci-run-fixtures'
import { expectEveryFocusableToCarryARing, expectFocusRing } from './focus-ring'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function renderGroup(runs: CiRunJobRunRecord[], jobKey?: string) {
  return render(
    <CiRunJobGroup projectId={PROJECT} ciRunExternalId="900" jobKey={jobKey} runs={runs} />,
  )
}

function passing(count: number): CiRunJobRunRecord[] {
  return Array.from({ length: count }, (_, index) =>
    ciRunJobRun(`pass-${index}`, { suiteName: `Passing ${index}`, name: `Passing ${index}` }),
  )
}

function failing(count: number): CiRunJobRunRecord[] {
  return Array.from({ length: count }, (_, index) =>
    ciRunJobRun(`fail-${index}`, { status: 'fail', suiteName: `Failing ${index}`, name: `Failing ${index}` }),
  )
}

describe('CiRunJobGroup heading', () => {
  it.each([
    ['api', 'api'],
    ['build-and-test', 'build and test'],
    ['lint_web', 'lint web'],
    ['test (node 20)', 'test (node 20)'],
  ])('titles the job %s as %s below the page heading', (jobKey, title) => {
    renderGroup(failing(1), jobKey)

    expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
  })

  it('renders no heading for the suites without a job', () => {
    renderGroup([...failing(1), ...passing(2)])

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Suites in the run' })).toBeInTheDocument()
  })

  it('names the suites list after the humanized job', () => {
    renderGroup(failing(1), 'build-and-test')

    expect(screen.getByRole('list', { name: 'build and test suites' })).toBeInTheDocument()
  })
})

describe('CiRunJobGroup long reporter text', () => {
  it('wraps the job heading, which the reporter supplies', () => {
    renderGroup(failing(1), 'api')

    expect(screen.getByRole('heading', { level: 3 })).toHaveClass('wrap-anywhere')
  })

  it('wraps the suite title instead of cutting off the end that tells suites apart', () => {
    renderGroup(failing(1), 'api')

    const title = screen.getByText('Failing 0')
    expect(title).toHaveClass('wrap-anywhere')
    expect(title).not.toHaveClass('truncate')
  })

  it('wraps the report label instead of cutting it off', () => {
    renderGroup(
      [
        ciRunJobRun('a', {
          status: 'fail',
          ciJobKey: 'api',
          reportExternalId: 'gha-900-api-junit-unit-xml-ab12cd34',
        }),
        ciRunJobRun('b', {
          status: 'fail',
          ciJobKey: 'api',
          reportExternalId: 'gha-900-api-junit-e2e-xml-ef56ab78',
        }),
      ],
      'api',
    )

    const label = screen.getByText('junit-unit-xml')
    expect(label).toHaveClass('font-mono', 'wrap-anywhere')
    expect(label).not.toHaveClass('truncate')
  })
})

describe('CiRunJobGroup without suites', () => {
  it.each([
    ['a job', 'api'],
    ['the section without a job', undefined],
  ])('renders nothing for %s that has no suites', (_label, jobKey) => {
    const { container } = renderGroup([], jobKey)

    expect(container).toBeEmptyDOMElement()
  })
})

describe('CiRunJobGroup suites', () => {
  it('lists the failing suites as links to the suite run with their status', () => {
    renderGroup(failing(2), 'api')

    const links = within(screen.getByRole('list', { name: 'api suites' })).getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/projects/proj-1/runs/fail-0')
    expect(links[0]).toHaveTextContent('FailFailing 0')
    expect(links[1]).toHaveAttribute('href', '/projects/proj-1/runs/fail-1')
  })

  it('titles a suite by the suite it belongs to and falls back to the run name', () => {
    renderGroup(
      [
        ciRunJobRun('a', { status: 'fail', suiteName: 'Checkout', name: 'checkout-report' }),
        ciRunJobRun('b', { status: 'fail', suiteName: '', name: 'Orphan report' }),
      ],
      'api',
    )

    expect(screen.getByRole('link', { name: /Checkout/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Orphan report/ })).toBeInTheDocument()
    expect(screen.queryByText('checkout-report')).not.toBeInTheDocument()
  })

  it('keeps every suite row at least 44px tall', () => {
    renderGroup(failing(1), 'api')

    expect(screen.getByRole('link')).toHaveClass('min-h-11')
  })

  it('draws the focus ring of a suite row inside the row so the scroll container cannot clip it', () => {
    renderGroup(failing(1), 'api')

    expectFocusRing(screen.getByRole('link'), { inset: true })
  })
})

describe('CiRunJobGroup suites without failures', () => {
  it('collapses them behind a disclosure that points at the region it controls', () => {
    renderGroup([...failing(2), ...passing(3)], 'api')

    const toggle = screen.getByRole('button', { name: 'Show 3 suites without failures' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const controlled = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(controlled).toBeInTheDocument()
    expect(within(controlled as HTMLElement).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.queryByText('Passing 0')).not.toBeInTheDocument()
  })

  it('keeps the 300 hidden suites out of the document until the disclosure is opened', async () => {
    const user = userEvent.setup()
    renderGroup([...failing(2), ...passing(300)], 'api')

    expect(screen.getAllByRole('link')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Show 300 suites without failures' }))

    const toggle = screen.getByRole('button', { name: 'Hide 300 suites without failures' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('link')).toHaveLength(302)
    const controlled = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(within(controlled as HTMLElement).getAllByRole('link')).toHaveLength(300)
  })

  it('removes the suites from the document again when the disclosure is closed', async () => {
    const user = userEvent.setup()
    renderGroup([...failing(1), ...passing(5)], 'api')

    await user.click(screen.getByRole('button', { name: 'Show 5 suites without failures' }))
    await user.click(screen.getByRole('button', { name: 'Hide 5 suites without failures' }))

    expect(screen.getByRole('button', { name: 'Show 5 suites without failures' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('opens and closes with Enter and with Space', async () => {
    const user = userEvent.setup()
    renderGroup([...failing(1), ...passing(2)], 'api')

    await user.tab()
    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Hide 2 suites without failures' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Show 2 suites without failures' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: 'Hide 2 suites without failures' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: 'Show 2 suites without failures' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('counts a single suite in the singular', async () => {
    const user = userEvent.setup()
    renderGroup([...failing(1), ...passing(1)], 'api')

    await user.click(screen.getByRole('button', { name: 'Show 1 suite without failures' }))

    expect(screen.getByRole('button', { name: 'Hide 1 suite without failures' })).toBeInTheDocument()
  })

  it('has no disclosure when every suite failed', () => {
    renderGroup(failing(3), 'api')

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('shows only the disclosure when no suite failed', async () => {
    const user = userEvent.setup()
    renderGroup(passing(4), 'api')

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show 4 suites without failures' })).toBeInTheDocument()

    await user.click(screen.getByRole('button'))

    expect(
      within(screen.getByRole('list', { name: 'api suites without failures' })).getAllByRole('link'),
    ).toHaveLength(4)
  })

  it('names the expanded list apart from the list of failing suites', async () => {
    const user = userEvent.setup()
    renderGroup([...failing(1), ...passing(2)], 'api')

    await user.click(screen.getByRole('button'))

    expect(within(screen.getByRole('list', { name: 'api suites' })).getAllByRole('link')).toHaveLength(1)
    expect(
      within(screen.getByRole('list', { name: 'api suites without failures' })).getAllByRole('link'),
    ).toHaveLength(2)
  })

  it('names the two lists of the section without a job apart as well', async () => {
    const user = userEvent.setup()
    renderGroup([...failing(1), ...passing(2)])

    await user.click(screen.getByRole('button'))

    expect(screen.getByRole('list', { name: 'Suites in the run' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Suites without failures in the run' })).toBeInTheDocument()
  })

  it('never gives two lists of one section the same accessible name', async () => {
    const user = userEvent.setup()
    renderGroup([...failing(2), ...passing(2)], 'api')

    await user.click(screen.getByRole('button'))

    const names = screen.getAllByRole('list').map((list) => list.getAttribute('aria-label'))
    expect(names).toHaveLength(2)
    expect(new Set(names).size).toBe(names.length)
  })

  it('names the expanded list in the active locale', async () => {
    const user = userEvent.setup()
    useI18nStore.setState({ locale: 'es' })
    renderGroup([...failing(1), ...passing(2)], 'api')

    await user.click(screen.getByRole('button'))

    expect(screen.getByRole('list', { name: 'Suites de api' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Suites sin fallos de api' })).toBeInTheDocument()
  })

  it('counts running and pending suites as without failures', () => {
    renderGroup(
      [
        ciRunJobRun('a', { status: 'fail' }),
        ciRunJobRun('b', { status: 'running' }),
        ciRunJobRun('c', { status: 'pending' }),
        ciRunJobRun('d', { status: 'pass' }),
      ],
      'api',
    )

    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Show 3 suites without failures' })).toBeInTheDocument()
  })

  it('makes the disclosure at least 44px tall', () => {
    renderGroup([...failing(1), ...passing(1)], 'api')

    expect(screen.getByRole('button')).toHaveClass('min-h-11')
  })

  it('shows a visible focus ring on the disclosure button', () => {
    renderGroup([...failing(1), ...passing(1)], 'api')

    expectFocusRing(screen.getByRole('button'), { inset: true })
  })

  it('leaves no focusable element of the open group without a ring', async () => {
    const user = userEvent.setup()
    const { container } = renderGroup([...failing(2), ...passing(2)], 'api')

    await user.click(screen.getByRole('button'))

    expectEveryFocusableToCarryARing(container, 5)
  })

  it('translates the disclosure with the active locale', () => {
    useI18nStore.setState({ locale: 'es' })

    renderGroup([...failing(1), ...passing(3)], 'api')

    expect(screen.getByRole('button', { name: 'Ver 3 suites sin fallos' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Suites de api' })).toBeInTheDocument()
  })
})

const UNIT_REPORT = 'gha-900-api-junit-unit-xml-ab12cd34'
const E2E_REPORT = 'gha-900-api-junit-e2e-xml-ef56ab78'

function reported(id: string, reportExternalId: string | undefined, overrides: Partial<CiRunJobRunRecord> = {}) {
  return ciRunJobRun(id, { ciJobKey: 'api', reportExternalId, ...overrides })
}

describe('CiRunJobGroup report labels', () => {
  it('tells the suites of two reports apart by the file each one came from', () => {
    renderGroup(
      [
        reported('a', UNIT_REPORT, { status: 'fail', suiteName: 'Alpha' }),
        reported('b', E2E_REPORT, { status: 'fail', suiteName: 'Beta' }),
      ],
      'api',
    )

    expect(within(screen.getByRole('link', { name: /Alpha/ })).getByText('junit-unit-xml')).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: /Beta/ })).getByText('junit-e2e-xml')).toBeInTheDocument()
  })

  it('shows no label when every suite came from the same report', () => {
    renderGroup(
      [
        reported('a', UNIT_REPORT, { status: 'fail', suiteName: 'Alpha' }),
        reported('b', UNIT_REPORT, { status: 'fail', suiteName: 'Beta' }),
      ],
      'api',
    )

    expect(screen.queryByText('junit-unit-xml')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Alpha/ })).toHaveTextContent(/^FailAlpha$/)
  })

  it('counts a report split in parts as one report', () => {
    renderGroup(
      [
        reported('a', `${UNIT_REPORT}-p1`, { status: 'fail', suiteName: 'Alpha' }),
        reported('b', `${UNIT_REPORT}-p2`, { status: 'fail', suiteName: 'Beta' }),
      ],
      'api',
    )

    expect(screen.queryByText('junit-unit-xml')).not.toBeInTheDocument()
  })

  it('decides from every suite of the section, including the ones still collapsed', async () => {
    const user = userEvent.setup()
    renderGroup(
      [
        reported('a', UNIT_REPORT, { status: 'fail', suiteName: 'Alpha' }),
        reported('b', E2E_REPORT, { suiteName: 'Beta' }),
      ],
      'api',
    )

    expect(within(screen.getByRole('link', { name: /Alpha/ })).getByText('junit-unit-xml')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show 1 suite without failures' }))

    expect(within(screen.getByRole('link', { name: /Beta/ })).getByText('junit-e2e-xml')).toBeInTheDocument()
  })

  it('shows no label for suites that carry no report id', () => {
    renderGroup(
      [
        reported('a', UNIT_REPORT, { status: 'fail', suiteName: 'Alpha' }),
        reported('b', undefined, { status: 'fail', suiteName: 'Beta' }),
      ],
      'api',
    )

    expect(screen.queryByText('junit-unit-xml')).not.toBeInTheDocument()
  })

  it('keeps the job in the label of suites that belong to no job', () => {
    renderGroup([
      ciRunJobRun('a', { status: 'fail', suiteName: 'Alpha', reportExternalId: UNIT_REPORT }),
      ciRunJobRun('b', {
        status: 'fail',
        suiteName: 'Beta',
        reportExternalId: 'gha-900-web-junit-xml-cd34ef56',
      }),
    ])

    expect(within(screen.getByRole('link', { name: /Alpha/ })).getByText('api-junit-unit-xml')).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: /Beta/ })).getByText('web-junit-xml')).toBeInTheDocument()
  })

  it('shows an id that does not follow the report format as it is', () => {
    renderGroup(
      [
        reported('a', 'custom-report-1', { status: 'fail', suiteName: 'Alpha' }),
        reported('b', 'custom-report-2', { status: 'fail', suiteName: 'Beta' }),
      ],
      'api',
    )

    expect(within(screen.getByRole('link', { name: /Alpha/ })).getByText('custom-report-1')).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: /Beta/ })).getByText('custom-report-2')).toBeInTheDocument()
  })
})
