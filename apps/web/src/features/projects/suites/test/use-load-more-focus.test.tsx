import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useLoadMoreFocus } from '@/features/projects/suites/hooks/use-load-more-focus'

interface HarnessProps {
  ids: string[]
  pageCount: number
  showButton?: boolean
}

function Harness({ ids, pageCount, showButton = true }: HarnessProps) {
  const { listProps, markActivation } = useLoadMoreFocus<HTMLDivElement>({
    rowCount: ids.length,
    pageCount,
  })

  return (
    <div>
      <input aria-label="Search" />
      <div {...listProps} data-testid="list">
        <ul>
          {ids.map((id) => (
            <li key={id}>
              <a href={`/suites/${id}`}>{id}</a>
            </li>
          ))}
        </ul>
      </div>
      {showButton && (
        <button type="button" onClick={(event) => markActivation(event.currentTarget)}>
          Load more
        </button>
      )}
    </div>
  )
}

const FIRST_PAGE = ['s1', 's2', 's3']
const TWO_PAGES = [...FIRST_PAGE, 's4', 's5', 's6']
const THREE_PAGES = [...TWO_PAGES, 's7', 's8', 's9']

describe('useLoadMoreFocus', () => {
  it('lets the list container take focus without joining the tab order', () => {
    render(<Harness ids={FIRST_PAGE} pageCount={1} />)

    expect(screen.getByTestId('list')).toHaveAttribute('tabindex', '-1')
  })

  describe('when the focus is on the load more button', () => {
    it('moves to the first new row once the page lands', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness ids={FIRST_PAGE} pageCount={1} />)

      await user.click(screen.getByRole('button', { name: 'Load more' }))
      expect(screen.getByRole('button', { name: 'Load more' })).toHaveFocus()
      rerender(<Harness ids={TWO_PAGES} pageCount={2} />)

      expect(screen.getByRole('link', { name: 's4' })).toHaveFocus()
    })

    it('lands on the row right after the ones already loaded, whatever their number', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness ids={['s1', 's2']} pageCount={1} />)

      await user.click(screen.getByRole('button', { name: 'Load more' }))
      rerender(<Harness ids={['s1', 's2', 's3']} pageCount={2} />)

      expect(screen.getByRole('link', { name: 's3' })).toHaveFocus()
    })

    it('waits for the page before it moves the focus, even when a row shows up meanwhile', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness ids={FIRST_PAGE} pageCount={1} />)

      await user.click(screen.getByRole('button', { name: 'Load more' }))
      rerender(<Harness ids={[...FIRST_PAGE, 'early']} pageCount={1} />)

      expect(screen.getByRole('button', { name: 'Load more' })).toHaveFocus()

      rerender(<Harness ids={TWO_PAGES} pageCount={2} />)

      expect(screen.getByRole('link', { name: 's4' })).toHaveFocus()
    })

    it('still lands on the first new row when the button leaves with the last page', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness ids={FIRST_PAGE} pageCount={1} />)

      await user.click(screen.getByRole('button', { name: 'Load more' }))
      rerender(<Harness ids={TWO_PAGES} pageCount={2} showButton={false} />)

      expect(screen.getByRole('link', { name: 's4' })).toHaveFocus()
    })

    it('moves to the list container when the page brings no new row and the button is gone', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness ids={FIRST_PAGE} pageCount={1} />)

      await user.click(screen.getByRole('button', { name: 'Load more' }))
      rerender(<Harness ids={FIRST_PAGE} pageCount={2} showButton={false} />)

      expect(screen.getByTestId('list')).toHaveFocus()
    })

    it('leaves the focus on the button when the page brings no new row and the button stays', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness ids={FIRST_PAGE} pageCount={1} />)

      await user.click(screen.getByRole('button', { name: 'Load more' }))
      rerender(<Harness ids={FIRST_PAGE} pageCount={2} />)

      expect(screen.getByRole('button', { name: 'Load more' })).toHaveFocus()
    })

    it('serves each activation with its own first new row', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness ids={FIRST_PAGE} pageCount={1} />)
      await user.click(screen.getByRole('button', { name: 'Load more' }))
      rerender(<Harness ids={TWO_PAGES} pageCount={2} />)

      await user.click(screen.getByRole('button', { name: 'Load more' }))
      rerender(<Harness ids={THREE_PAGES} pageCount={3} />)

      expect(screen.getByRole('link', { name: 's7' })).toHaveFocus()
    })

    it('forgets an activation whose page brought no new row, so a later row change leaves the focus alone', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness ids={FIRST_PAGE} pageCount={1} />)
      await user.click(screen.getByRole('button', { name: 'Load more' }))
      rerender(<Harness ids={FIRST_PAGE} pageCount={2} />)

      rerender(<Harness ids={[...FIRST_PAGE, 'refreshed']} pageCount={2} />)

      expect(screen.getByRole('button', { name: 'Load more' })).toHaveFocus()
    })

    it('does not move the focus on a row change while the page has not landed, as when it failed or is paused', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness ids={FIRST_PAGE} pageCount={1} />)
      await user.click(screen.getByRole('button', { name: 'Load more' }))

      rerender(<Harness ids={[...FIRST_PAGE, 'refreshed']} pageCount={1} />)
      rerender(<Harness ids={[...FIRST_PAGE, 'refreshed', 'again']} pageCount={1} />)

      expect(screen.getByRole('button', { name: 'Load more' })).toHaveFocus()
    })
  })

  describe('when the focus is not on the load more button', () => {
    it('does not take the focus from where the user moved it while the page loaded', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness ids={FIRST_PAGE} pageCount={1} />)

      await user.click(screen.getByRole('button', { name: 'Load more' }))
      await user.click(screen.getByRole('textbox', { name: 'Search' }))
      rerender(<Harness ids={TWO_PAGES} pageCount={2} />)

      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus()
    })

    it('does not move the focus when the button was activated without taking it', () => {
      const { rerender } = render(<Harness ids={FIRST_PAGE} pageCount={1} />)

      fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
      rerender(<Harness ids={TWO_PAGES} pageCount={2} />)

      expect(document.body).toHaveFocus()
    })

    it('does not move the focus when rows appear without an activation', () => {
      const { rerender } = render(<Harness ids={FIRST_PAGE} pageCount={1} />)
      screen.getByRole('button', { name: 'Load more' }).focus()

      rerender(<Harness ids={TWO_PAGES} pageCount={2} />)

      expect(screen.getByRole('button', { name: 'Load more' })).toHaveFocus()
    })
  })
})
