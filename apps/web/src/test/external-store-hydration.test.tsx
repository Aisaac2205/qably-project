import { act, waitFor } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIsMobile } from '@/hooks/use-mobile'
import { __resetStore, getSnapshot, subscribe } from '@/lib/mock-store'
import { useProposals, useChatMessages, useMembers } from '@/lib/use-mock-store'

function SeededCounts() {
  const proposals = useProposals('proj-1')
  const members = useMembers()
  return <output>{proposals.length}:{members.length}</output>
}

function MobileState() {
  return <output>{useIsMobile() ? 'mobile' : 'desktop'}</output>
}

function UnseededChat() {
  return <output>{useChatMessages('proj-2').length}</output>
}

function hydrate(element: React.ReactNode) {
  const container = document.createElement('div')
  container.innerHTML = renderToString(element)
  document.body.append(container)
  const recoverableErrors: unknown[] = []
  const root = hydrateRoot(container, element, {
    onRecoverableError: (error) => recoverableErrors.push(error),
  })
  return { container, root, recoverableErrors }
}

describe('external-store hydration', () => {
  beforeEach(() => {
    __resetStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('hydrates seeded store markup without a recoverable error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { container, root, recoverableErrors } = hydrate(<SeededCounts />)

    try {
      expect(container).toHaveTextContent('6:3')

      await waitFor(() => expect(recoverableErrors).toEqual([]))
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('The result of getServerSnapshot should be cached'),
      )
    } finally {
      act(() => root.unmount())
      container.remove()
    }
  })

  it('reads an unseeded chat during SSR without creating a thread or notifying', () => {
    let notifications = 0
    const unsubscribe = subscribe(() => { notifications += 1 })
    notifications = 0
    const threadsBefore = getSnapshot().chatThreads

    try {
      expect(renderToString(<UnseededChat />)).toContain('>0<')
      expect(renderToString(<UnseededChat />)).toContain('>0<')
      expect(getSnapshot().chatThreads).toBe(threadsBefore)
      expect(getSnapshot().chatThreads.some((thread) => thread.projectId === 'proj-2')).toBe(false)
      expect(notifications).toBe(0)
    } finally {
      unsubscribe()
    }
  })

  it('leaves the desktop server fallback and activates mobile state after hydration', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 767px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))

    const { container, root, recoverableErrors } = hydrate(<MobileState />)
    expect(container).toHaveTextContent('desktop')

    await waitFor(() => expect(container).toHaveTextContent('mobile'))
    expect(recoverableErrors).toEqual([])

    act(() => root.unmount())
    container.remove()
  })
})
