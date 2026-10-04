import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useI18nStore } from '@/lib/i18n'

describe('Dialog', () => {
  it('renders trigger and opens content on click', async () => {
    const user = userEvent.setup()
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog description text.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    expect(screen.getByText('Dialog description text.')).toBeInTheDocument()
  })

  it('closes on ESC key', async () => {
    const user = userEvent.setup()
    render(
      <Dialog defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Test</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByText('Close Test')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByText('Close Test')).not.toBeInTheDocument()
  })

  describe('close button', () => {
    function renderOpen() {
      render(
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>Dialog description text.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      )
    }

    it.each([
      ['en', 'Close'],
      ['es', 'Cerrar'],
    ] as const)('is named through the translated close label (%s)', (locale, name) => {
      useI18nStore.setState({ locale })

      renderOpen()

      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    })

    it('is a 44px target below md and a 24px target from md', () => {
      renderOpen()

      const close = screen.getByRole('button', { name: 'Close' })
      expect(close).toHaveClass('size-11', 'md:size-6')
      expect(close).not.toHaveClass('size-6')
      expect(close).toHaveClass('right-0.5', 'top-0.5', 'md:right-3', 'md:top-3')
    })

    it('keeps a visible focus indicator in forced colors as well as in normal colors', () => {
      renderOpen()

      const close = screen.getByRole('button', { name: 'Close' })
      expect(close).toHaveClass(
        'focus-visible:outline-hidden!',
        'focus-visible:ring-2',
        'focus-visible:ring-primary',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-background',
      )
      expect(close.className).not.toMatch(/(^|\s)focus:outline-none/)
    })

    it('is enabled by default and disabled when the content asks for it', () => {
      const { rerender } = render(
        <Dialog open>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>,
      )
      expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled()

      rerender(
        <Dialog open>
          <DialogContent closeDisabled>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>,
      )

      expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    })

    it('draws the focus indicator inside its own box so the popup edge cannot clip it', () => {
      renderOpen()

      const close = screen.getByRole('button', { name: 'Close' })
      expect(close).toHaveClass(
        'focus-visible:ring-inset',
        'forced-colors:focus-visible:-outline-offset-2!',
      )
    })
  })
})
