import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BackButton } from '@/components/ui/back-button'
import { expectFocusRing } from '@/features/runs/test/focus-ring'
import { useI18nStore } from '@/lib/i18n'

describe('BackButton', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('is named by the shared back label and adds no native title by default', () => {
    render(<BackButton onClick={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Back' })
    expect(button).not.toHaveAttribute('title')
  })

  it('uses a custom label as both the accessible name and the native title', () => {
    render(<BackButton onClick={vi.fn()} label="Back to queue" />)

    const button = screen.getByRole('button', { name: 'Back to queue' })
    expect(button).toHaveAttribute('title', 'Back to queue')
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<BackButton onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('keeps a 44px touch target below md and shrinks to 32px from md up', () => {
    render(<BackButton onClick={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Back' })
    expect(button).toHaveClass('size-11', 'md:size-8')
    expect(button).not.toHaveClass('size-8')
  })

  it('carries the project focus ring, which survives the global button outline reset and forced colors', () => {
    render(<BackButton onClick={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Back' })
    expectFocusRing(button)
    expect(button).not.toHaveClass('outline-none')
  })

  it('keeps the caller class alongside its own', () => {
    render(<BackButton onClick={vi.fn()} className="md:hidden" />)

    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass('md:hidden', 'size-11')
  })
})
