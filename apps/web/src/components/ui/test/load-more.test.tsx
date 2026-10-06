import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoadMore } from '@/components/ui/load-more'
import { expectFocusRing } from '@/features/runs/test/focus-ring'

const LABELS = {
  load: 'Show more',
  loading: 'Fetching more',
  retry: 'Try again',
  error: 'Could not load the next page',
}

function renderLoadMore(props: Partial<React.ComponentProps<typeof LoadMore>> = {}) {
  const onLoad = vi.fn()

  render(<LoadMore isFetching={false} hasFailed={false} onLoad={onLoad} labels={LABELS} {...props} />)

  return { onLoad }
}

describe('LoadMore', () => {
  it('is named by the load label and calls onLoad once per click', async () => {
    const user = userEvent.setup()
    const { onLoad } = renderLoadMore()

    await user.click(screen.getByRole('button', { name: 'Show more' }))

    expect(onLoad).toHaveBeenCalledTimes(1)
  })

  it('is operable from the keyboard with Enter and Space', async () => {
    const user = userEvent.setup()
    const { onLoad } = renderLoadMore()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Show more' })).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onLoad).toHaveBeenCalledTimes(2)
  })

  it('shows no alert while nothing has failed', () => {
    renderLoadMore()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the loading label, stays focusable and ignores clicks while fetching', async () => {
    const user = userEvent.setup()
    const { onLoad } = renderLoadMore({ isFetching: true })

    const busy = screen.getByRole('button', { name: 'Fetching more' })
    expect(busy).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()

    await user.tab()
    expect(busy).toHaveFocus()
    await user.click(busy)
    await user.keyboard('{Enter}')

    expect(onLoad).not.toHaveBeenCalled()
  })

  it('announces the failure in an alert and turns the button into a retry', async () => {
    const user = userEvent.setup()
    const { onLoad } = renderLoadMore({ hasFailed: true })

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the next page')
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(onLoad).toHaveBeenCalledTimes(1)
  })

  it('hides the failure while the retry is in flight', () => {
    renderLoadMore({ hasFailed: true, isFetching: true })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fetching more' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('keeps a 44px touch target, the focus ring and the caller class on the button', () => {
    renderLoadMore({ className: 'hover:bg-runs-hover' })

    const button = screen.getByRole('button', { name: 'Show more' })
    expect(button).toHaveClass('h-11', 'w-full', 'sm:w-auto', 'hover:bg-runs-hover')
    expectFocusRing(button)
  })
})
