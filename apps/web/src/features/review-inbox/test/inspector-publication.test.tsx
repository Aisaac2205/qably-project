import { render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import { useI18nStore } from '@/lib/i18n'
import { InspectorPublication } from '../components/inspector/inspector-publication'
import type {
  MatchedCaseView,
  ProposalSourceView,
  RecentRunView,
  LastDecisionView,
  PublishedVersionView,
} from '../api/review.api'

const matchedCase: MatchedCaseView = {
  id: 'case-1',
  name: 'Empties the cart',
  suiteId: 'suite-1',
  suiteName: 'Checkout',
}

const source: ProposalSourceView = {
  filePath: 'src/checkout/cart.spec.ts',
  uri: 'file://src/checkout/cart.spec.ts',
  commitSha: 'abcdef1234567890',
  pullRequestNumber: 42,
}

const recentRuns: RecentRunView[] = [
  { runId: 'run-1', status: 'pass', recordedAt: '2026-09-20T10:00:00.000Z' },
  { runId: 'run-2', status: 'fail', recordedAt: '2026-09-19T10:00:00.000Z' },
]

const decision: LastDecisionView = {
  action: 'approved',
  decidedAt: '2026-09-18T10:00:00.000Z',
  decidedBy: { id: 'user-1', name: 'Dana' },
}

const publishedVersion: PublishedVersionView = {
  version: 3,
  title: 'Empties the cart',
  objective: 'Confirm the cart resets',
  preconditions: [],
  steps: ['Open the cart'],
  expectedResult: 'The cart shows zero items',
  publishedAt: '2026-09-21T10:00:00.000Z',
  publishedBy: { id: 'user-2', name: 'Sam' },
}

describe('InspectorPublication', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders nothing when there is no matched case, source, run history or decision', () => {
    const { container } = render(
      <InspectorPublication
        projectId="project-1"
        matchedCase={null}
        source={null}
        recentRuns={[]}
        decision={null}
        publishedVersion={null}
      />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('links to the matched case inside its suite', () => {
    render(
      <InspectorPublication
        projectId="project-1"
        matchedCase={matchedCase}
        source={null}
        recentRuns={[]}
        decision={null}
        publishedVersion={null}
      />,
    )

    const link = screen.getByRole('link', { name: /Empties the cart/ })
    expect(link).toHaveAttribute('href', expect.stringContaining('suite-1'))
    expect(link).toHaveAttribute('href', expect.stringContaining('case-1'))
    expect(screen.getByText('Checkout', { exact: false })).toBeInTheDocument()
  })

  it('shows the source file path, commit and pull request', () => {
    render(
      <InspectorPublication
        projectId="project-1"
        matchedCase={null}
        source={source}
        recentRuns={[]}
        decision={null}
        publishedVersion={null}
      />,
    )

    expect(screen.getByText('src/checkout/cart.spec.ts')).toBeInTheDocument()
    expect(screen.getByText('Commit abcdef1')).toBeInTheDocument()
    expect(screen.getByText('PR #42')).toBeInTheDocument()
  })

  it('says there are no recorded runs yet when the matched case has none', () => {
    render(
      <InspectorPublication
        projectId="project-1"
        matchedCase={matchedCase}
        source={null}
        recentRuns={[]}
        decision={null}
        publishedVersion={null}
      />,
    )

    expect(
      screen.getByText('No recorded runs yet for the matched case.'),
    ).toBeInTheDocument()
  })

  it('lists recent run statuses for the matched case', () => {
    render(
      <InspectorPublication
        projectId="project-1"
        matchedCase={matchedCase}
        source={null}
        recentRuns={recentRuns}
        decision={null}
        publishedVersion={null}
      />,
    )

    expect(screen.getByText('Pass')).toBeInTheDocument()
    expect(screen.getByText('Fail')).toBeInTheDocument()
    expect(
      screen.queryByText('No recorded runs yet for the matched case.'),
    ).not.toBeInTheDocument()
  })

  it('credits the approver and time when the version was published', () => {
    render(
      <InspectorPublication
        projectId="project-1"
        matchedCase={null}
        source={null}
        recentRuns={[]}
        decision={decision}
        publishedVersion={publishedVersion}
      />,
    )

    expect(screen.getByText(/Published by Sam/)).toBeInTheDocument()
  })

  it('notes the approver is unknown when the published version has no linked decision', () => {
    render(
      <InspectorPublication
        projectId="project-1"
        matchedCase={null}
        source={null}
        recentRuns={[]}
        decision={null}
        publishedVersion={{ ...publishedVersion, publishedBy: null }}
      />,
    )

    expect(screen.getByText(/approver unknown/)).toBeInTheDocument()
  })

  it('falls back to the last decision when there is no published version, e.g. a rejection', () => {
    render(
      <InspectorPublication
        projectId="project-1"
        matchedCase={null}
        source={null}
        recentRuns={[]}
        decision={{ ...decision, action: 'rejected' }}
        publishedVersion={null}
      />,
    )

    expect(screen.getByText(/Rejected by Dana/)).toBeInTheDocument()
  })
})
