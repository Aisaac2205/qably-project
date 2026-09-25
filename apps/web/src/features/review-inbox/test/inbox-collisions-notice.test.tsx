import { render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import { useI18nStore } from '@/lib/i18n'
import { InboxCollisionsNotice } from '../components/inbox-collisions-notice'

describe('InboxCollisionsNotice', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders nothing when there are no open collisions', () => {
    const { container } = render(<InboxCollisionsNotice openCollisions={0} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('uses the singular plural key for exactly one open collision', () => {
    render(<InboxCollisionsNotice openCollisions={1} />)

    expect(
      screen.getByText('1 test suite has an open case identity collision to resolve.'),
    ).toBeInTheDocument()
  })

  it('uses the plural key for more than one open collision', () => {
    render(<InboxCollisionsNotice openCollisions={4} />)

    expect(
      screen.getByText('4 test suites have open case identity collisions to resolve.'),
    ).toBeInTheDocument()
  })

  it('surfaces the notice inside a status region so assistive tech announces it', () => {
    render(<InboxCollisionsNotice openCollisions={2} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '2 test suites have open case identity collisions to resolve.',
    )
  })
})
