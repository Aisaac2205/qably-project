import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReviewInboxFeedback } from '../components/review-inbox-feedback'

const LONG_ERROR =
  'Couldn\'t publish this proposal: an official case named "Empties the cart" already exists in this suite. Reject the proposal, or rename or remove that case and approve again.'

describe('ReviewInboxFeedback', () => {
  it('announces an error toast as an alert with its link', () => {
    render(
      <ReviewInboxFeedback
        toast={{
          message: LONG_ERROR,
          type: 'error',
          href: '/projects/p1/suites/s1/edit?case=c1',
          linkLabel: 'View existing case',
        }}
        onDismiss={vi.fn()}
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(LONG_ERROR)
    expect(within(alert).getByRole('link', { name: 'View existing case' })).toHaveAttribute(
      'href',
      '/projects/p1/suites/s1/edit?case=c1',
    )
  })

  it('wraps a long message instead of cutting it off with an ellipsis', () => {
    render(
      <ReviewInboxFeedback
        toast={{ message: LONG_ERROR, type: 'error' }}
        onDismiss={vi.fn()}
      />,
    )

    const message = screen.getByText(LONG_ERROR)
    expect(message).not.toHaveClass('truncate')
    expect(message).toHaveClass('break-words')
  })

  it('renders no link when the toast carries none', () => {
    render(
      <ReviewInboxFeedback
        toast={{ message: LONG_ERROR, type: 'error' }}
        onDismiss={vi.fn()}
      />,
    )

    expect(within(screen.getByRole('alert')).queryByRole('link')).not.toBeInTheDocument()
  })

  it('keeps announcing non-error toasts as a polite status', () => {
    render(
      <ReviewInboxFeedback
        toast={{ message: 'Proposal rejected.', type: 'info' }}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Proposal rejected.')
  })

  it('names the close control Dismiss and calls back when it is pressed', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(
      <ReviewInboxFeedback
        toast={{ message: LONG_ERROR, type: 'error' }}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('says how many times an error happened when it happened more than once', () => {
    render(
      <ReviewInboxFeedback
        toast={{ message: 'Could not process this decision.', type: 'error' }}
        count={4}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Happened 4 times')
  })

  it('keeps quiet about the count for an error that happened once', () => {
    render(
      <ReviewInboxFeedback
        toast={{ message: 'Could not process this decision.', type: 'error' }}
        count={1}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).not.toHaveTextContent(/happened/i)
  })

  it('renders nothing without a toast', () => {
    const { container } = render(<ReviewInboxFeedback toast={null} onDismiss={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })
})
