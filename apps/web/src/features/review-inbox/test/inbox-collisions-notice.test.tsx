import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach } from 'vitest'
import { useI18nStore } from '@/lib/i18n'
import type { OpenCollisionSuite } from '../api/review.api'
import { InboxCollisionsNotice } from '../components/inbox-collisions-notice'

function collisionSuite(index: number, count = 1): OpenCollisionSuite {
  return {
    suiteId: `suite-${index}`,
    suiteName: `Suite ${index}`,
    projectId: `project-${index}`,
    projectName: `Project ${index}`,
    count,
  }
}

function collisionSuites(total: number): OpenCollisionSuite[] {
  return Array.from({ length: total }, (_, index) => collisionSuite(index + 1))
}

describe('InboxCollisionsNotice', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders nothing when no suite has an open collision', () => {
    const { container } = render(<InboxCollisionsNotice suites={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('counts suites, not keys, in the singular', () => {
    render(<InboxCollisionsNotice suites={[collisionSuite(1, 3)]} />)

    expect(
      screen.getByText('1 test suite has an open case identity collision to resolve.'),
    ).toBeInTheDocument()
  })

  it('counts suites, not keys, in the plural', () => {
    render(<InboxCollisionsNotice suites={[collisionSuite(1, 4), collisionSuite(2, 2)]} />)

    expect(
      screen.getByText('2 test suites have open case identity collisions to resolve.'),
    ).toBeInTheDocument()
  })

  it('surfaces the summary inside a status region so assistive tech announces it', () => {
    render(<InboxCollisionsNotice suites={collisionSuites(2)} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '2 test suites have open case identity collisions to resolve.',
    )
  })

  it('links each affected suite to its page with its project and key count', () => {
    render(<InboxCollisionsNotice suites={[collisionSuite(1, 3)]} />)

    const link = screen.getByRole('link', { name: /Suite 1/ })
    expect(link).toHaveAttribute('href', '/projects/project-1/suites/suite-1')
    expect(link).toHaveTextContent('Project 1')
    expect(link).toHaveTextContent('3 keys')
  })

  it('shows every suite without a toggle when there are only a few', () => {
    render(<InboxCollisionsNotice suites={collisionSuites(3)} />)

    expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(3)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('collapses a long list behind a toggle that reports whether it is expanded', async () => {
    const user = userEvent.setup()
    render(<InboxCollisionsNotice suites={collisionSuites(6)} />)

    const toggle = screen.getByRole('button', { name: 'Show all 6 suites' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(3)

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAccessibleName('Show fewer suites')
    expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(6)
  })
})
