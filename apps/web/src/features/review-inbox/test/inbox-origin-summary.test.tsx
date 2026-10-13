import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ProposalOrigin } from '@qably/types'
import { useI18nStore } from '@/lib/i18n'
import type { ProposalListItem } from '../api/review.api'
import { InboxOriginSummary } from '../components/inbox-origin-summary'
import { summarizeOrigins } from '../lib/summarize-origins'

type PushOrigin = Extract<ProposalOrigin, { kind: 'push' }>

let sequence = 0

function proposal(origin: ProposalOrigin | undefined): ProposalListItem {
  sequence += 1
  return {
    id: `proposal-${sequence}`,
    projectId: 'project-1',
    status: 'in_review',
    title: 'Empties the cart',
    objective: 'Confirm the cart resets',
    preconditions: [],
    steps: ['Open the cart'],
    expectedResult: 'The cart shows zero items',
    priority: 'medium',
    evidenceId: 'evidence-1',
    evidenceTitle: 'src/cart.spec.ts',
    needsManualReview: false,
    origin,
  }
}

function push(commitSha: string | null, extra: Partial<PushOrigin> = {}): PushOrigin {
  return {
    kind: 'push',
    commitSha,
    commitTitle: 'Add login tests',
    author: 'ana',
    branch: 'main',
    pullRequestNumber: null,
    ...extra,
  }
}

function many(count: number, origin: ProposalOrigin): ProposalListItem[] {
  return Array.from({ length: count }, () => proposal(origin))
}

describe('summarizeOrigins', () => {
  it('groups push proposals per commit and the others per kind, largest group first', () => {
    const groups = summarizeOrigins([
      ...many(2, { kind: 'chat' }),
      ...many(3, push('abc1234def')),
      ...many(1, push('fff0000aaa')),
      ...many(2, { kind: 'documentation' }),
    ])

    expect(groups.map((group) => [group.key, group.count])).toEqual([
      ['push:abc1234def', 3],
      ['chat', 2],
      ['documentation', 2],
      ['push:fff0000aaa', 1],
    ])
  })

  it('ignores items whose payload carries no origin', () => {
    expect(summarizeOrigins([proposal(undefined)])).toEqual([])
  })
})

describe('InboxOriginSummary', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders nothing when there is nothing to explain', () => {
    const { container } = render(<InboxOriginSummary proposals={[]} hasMore={false} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('explains that a push brings one proposal per test found in its changed test files', () => {
    render(<InboxOriginSummary proposals={many(3, push('abc1234def'))} hasMore={false} />)

    expect(
      screen.getByText(/one proposal per test it finds in the test files each push changes/i),
    ).toBeInTheDocument()
  })

  it('describes a push group with its count, short commit, title, author and branch', () => {
    render(<InboxOriginSummary proposals={many(3, push('abc1234def'))} hasMore={false} />)

    const item = screen.getByRole('listitem')
    expect(item).toHaveTextContent('3')
    expect(within(item).getByText('abc1234').className).toContain('font-mono')
    expect(item).toHaveTextContent('Add login tests')
    expect(item).toHaveTextContent('by ana')
    expect(item).toHaveTextContent('on main')
  })

  it('describes documentation and chat groups in plain words', () => {
    render(
      <InboxOriginSummary
        proposals={[...many(2, { kind: 'documentation' }), ...many(1, { kind: 'chat' })]}
        hasMore={false}
      />,
    )

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent(/2\s*from Aeris documentation/)
    expect(items[1]).toHaveTextContent(/1\s*from the Aeris chat/)
  })

  it('keeps long breakdowns short behind a disclosure', async () => {
    const user = userEvent.setup()
    render(
      <InboxOriginSummary
        proposals={[
          ...many(5, push('aaa1111')),
          ...many(4, push('bbb2222')),
          ...many(3, push('ccc3333')),
          ...many(2, { kind: 'chat' }),
          ...many(1, { kind: 'documentation' }),
        ]}
        hasMore={false}
      />,
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    const toggle = screen.getByRole('button', { name: /show 2 more sources/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByRole('button', { name: /show fewer sources/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('says the counts cover only the loaded proposals while more pages remain', () => {
    render(<InboxOriginSummary proposals={many(3, push('abc1234def'))} hasMore />)

    expect(screen.getByText(/counts cover the 3 proposals loaded so far/i)).toBeInTheDocument()
  })

  it('labels the summary so assistive tech can find it', () => {
    render(<InboxOriginSummary proposals={many(1, { kind: 'chat' })} hasMore={false} />)

    const region = screen.getByRole('region', { name: /where these proposals came from/i })
    expect(within(region).getByRole('list')).toBeInTheDocument()
  })
})
