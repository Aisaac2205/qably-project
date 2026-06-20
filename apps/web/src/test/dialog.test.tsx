import { render, screen, act } from '@testing-library/react'
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

describe('Dialog', () => {
  it('renders trigger and opens content on click', async () => {
    const user = userEvent.setup()
    await act(async () => {
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
    })
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Open' }))
    })
    expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    expect(screen.getByText('Dialog description text.')).toBeInTheDocument()
  })

  it('closes on ESC key', async () => {
    const user = userEvent.setup()
    await act(async () => {
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
    })
    expect(screen.getByText('Close Test')).toBeInTheDocument()
    await act(async () => {
      await user.keyboard('{Escape}')
    })
    // After ESC, the dialog content should be gone
    expect(screen.queryByText('Close Test')).not.toBeInTheDocument()
  })
})
