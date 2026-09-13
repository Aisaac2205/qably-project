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
