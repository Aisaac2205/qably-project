'use client'

import { useEffect, useEffectEvent } from 'react'

type KeyHandler = (e: KeyboardEvent) => void

export function useKeyboardShortcuts(
  handlers: Partial<Record<string, KeyHandler>>,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true
  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
      if (!enabled) return

      const target = e.target as HTMLElement
      const tag = target.tagName
      const isContentEditable =
        target.getAttribute?.('contenteditable') === 'true' ||
        target.getAttribute?.('contentEditable') === 'true'

      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isContentEditable) {
        return
      }

      const handler = handlers[e.key]
      if (handler) {
        e.preventDefault()
        handler(e)
      }
  })

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
