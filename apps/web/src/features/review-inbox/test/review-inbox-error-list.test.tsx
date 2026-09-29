import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useI18nStore } from '@/lib/i18n'
import type { InboxFeedbackToast } from '../hooks/use-inbox-feedback'
import { ReviewInboxErrorList } from '../components/review-inbox-error-list'

function error(id: number, message: string, href?: string): InboxFeedbackToast {
  return {
    id,
    message,
    type: 'error',
    ...(href === undefined ? {} : { href, linkLabel: 'View existing case' }),
  }
}

function errors(count: number): InboxFeedbackToast[] {
  return Array.from({ length: count }, (_, index) => error(index + 1, `Failure ${index + 1}`))
}

describe('ReviewInboxErrorList', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders nothing when there are no errors', () => {
    const { container } = render(<ReviewInboxErrorList errors={[]} onDismiss={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('announces each error in its own alert while they fit', () => {
    render(<ReviewInboxErrorList errors={errors(3)} onDismiss={vi.fn()} />)

    const alerts = screen.getAllByRole('alert')
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      expect.stringContaining('Failure 1'),
      expect.stringContaining('Failure 2'),
      expect.stringContaining('Failure 3'),
    ])
    expect(screen.queryByText(/more error/i)).not.toBeInTheDocument()
  })

  it('shows only the newest three errors and says how many are left out', () => {
    render(<ReviewInboxErrorList errors={errors(5)} onDismiss={vi.fn()} />)

    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(3)
    expect(alerts[0]).toHaveTextContent('Failure 3')
    expect(alerts[2]).toHaveTextContent('Failure 5')
    expect(screen.queryByText('Failure 1')).not.toBeInTheDocument()
    expect(screen.getByText('And 2 more errors')).toBeInTheDocument()
  })

  it('uses the singular form when a single error is left out', () => {
    render(<ReviewInboxErrorList errors={errors(4)} onDismiss={vi.fn()} />)

    expect(screen.getByText('And 1 more error')).toBeInTheDocument()
  })

  it('clears only the errors that are left out', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(<ReviewInboxErrorList errors={errors(5)} onDismiss={onDismiss} />)

    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith([1, 2])
  })

  it('tells assistive technology which errors the clear control removes', () => {
    render(<ReviewInboxErrorList errors={errors(5)} onDismiss={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Clear' })).toHaveAccessibleDescription(
      'And 2 more errors',
    )
  })

  it('merges identical messages into one alert that says how many times it happened', () => {
    render(
      <ReviewInboxErrorList
        errors={[
          error(1, 'Could not process this decision.'),
          error(2, 'Could not process this decision.'),
          error(3, 'Could not process this decision.'),
        ]}
        onDismiss={vi.fn()}
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Could not process this decision.')
    expect(alert).toHaveTextContent('Happened 3 times')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('does not mention a count for an error that happened once', () => {
    render(<ReviewInboxErrorList errors={errors(1)} onDismiss={vi.fn()} />)

    expect(screen.queryByText(/happened/i)).not.toBeInTheDocument()
  })

  it('dismisses every occurrence of a merged alert with one press of a control named Dismiss', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(
      <ReviewInboxErrorList
        errors={[error(1, 'Same.'), error(2, 'Same.'), error(3, 'Other.')]}
        onDismiss={onDismiss}
      />,
    )

    const [merged] = screen.getAllByRole('alert')
    await user.click(within(merged).getByRole('button', { name: 'Dismiss' }))

    expect(onDismiss).toHaveBeenCalledWith([1, 2])
  })

  it('names every dismiss control Dismiss instead of Cancel', () => {
    render(<ReviewInboxErrorList errors={errors(2)} onDismiss={vi.fn()} />)

    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('keeps the link of an error inside its own alert', () => {
    render(
      <ReviewInboxErrorList
        errors={[error(1, 'Blocked.', '/projects/p1/suites/s1/edit?case=c1')]}
        onDismiss={vi.fn()}
      />,
    )

    expect(
      within(screen.getByRole('alert')).getByRole('link', { name: 'View existing case' }),
    ).toHaveAttribute('href', '/projects/p1/suites/s1/edit?case=c1')
  })

  it('speaks Spanish with the right plural forms', () => {
    useI18nStore.setState({ locale: 'es' })
    const { rerender } = render(<ReviewInboxErrorList errors={errors(5)} onDismiss={vi.fn()} />)

    expect(screen.getByText('Y 2 errores más')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Descartar' })).toHaveLength(3)

    rerender(<ReviewInboxErrorList errors={errors(4)} onDismiss={vi.fn()} />)

    expect(screen.getByText('Y 1 error más')).toBeInTheDocument()
  })
})
