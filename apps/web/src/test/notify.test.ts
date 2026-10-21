import { describe, expect, it, vi, beforeEach } from 'vitest'

const success = vi.fn()
const info = vi.fn()
const warning = vi.fn()
const error = vi.fn()
const dismiss = vi.fn()

vi.mock('sonner', () => ({
  toast: { success, info, warning, error, dismiss },
}))

const { notify } = await import('@/lib/notify')

describe('notify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets a success dismiss itself on the shared default', () => {
    notify.success('Aeris documented 12 cases in this suite.')

    expect(success).toHaveBeenCalledWith(
      'Aeris documented 12 cases in this suite.',
      undefined,
    )
  })

  it('keeps an error on screen until a person dismisses it', () => {
    notify.error('Could not confirm the documentation.')

    expect(error).toHaveBeenCalledWith('Could not confirm the documentation.', {
      duration: Infinity,
    })
  })

  it('keeps the error persistent even when it carries a description', () => {
    notify.error('Could not confirm the documentation.', {
      description: 'Try again in a moment.',
    })

    expect(error).toHaveBeenCalledWith('Could not confirm the documentation.', {
      description: 'Try again in a moment.',
      duration: Infinity,
    })
  })

  it('gives a toast with an action a styled button, since the shared toaster ships none', () => {
    const onClick = vi.fn()

    notify.info('18 new proposals from push 518952c', {
      action: { label: 'View', onClick },
    })

    const [, options] = info.mock.calls[0] as [string, Record<string, unknown>]
    expect(options.action).toEqual({ label: 'View', onClick })
    expect(options.classNames).toEqual({ actionButton: expect.stringContaining('border-border') })
  })

  it('shows keyboard focus on the action as a ring, because every button loses its outline', () => {
    notify.info('18 new proposals', { action: { label: 'View', onClick: vi.fn() } })

    const [, options] = info.mock.calls[0] as [string, { classNames: { actionButton: string } }]
    expect(options.classNames.actionButton).toContain('focus-visible:ring-2')
    expect(options.classNames.actionButton).not.toContain('focus-visible:outline')
  })

  it('lets a caller name the toast so the same event never stacks twice', () => {
    notify.info('18 new proposals', { id: 'notification-1', description: 'main' })

    expect(info).toHaveBeenCalledWith('18 new proposals', {
      id: 'notification-1',
      description: 'main',
    })
  })

  it('does not add classNames to a toast that has no action', () => {
    notify.warning('Some cases were skipped.', { description: 'A person documented them.' })

    const [, options] = warning.mock.calls[0] as [string, Record<string, unknown>]
    expect(options).not.toHaveProperty('classNames')
  })

  it('passes a description through on the non-blocking variants', () => {
    notify.info('Aeris is documenting this suite.', { description: 'It may take a minute.' })
    notify.warning('Some cases were skipped.', { description: 'A person documented them.' })

    expect(info).toHaveBeenCalledWith('Aeris is documenting this suite.', {
      description: 'It may take a minute.',
    })
    expect(warning).toHaveBeenCalledWith('Some cases were skipped.', {
      description: 'A person documented them.',
    })
  })
})
