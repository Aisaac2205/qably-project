'use client'

import { useEffect, useCallback, useRef } from 'react'

type KeyHandler = (e: KeyboardEvent) => void

export function useKeyboardShortcuts(
  handlers: Partial<Record<string, KeyHandler>>,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      const target = e.target as HTMLElement
      const tag = target.tagName
      const isContentEditable =
        target.getAttribute?.('contenteditable') === 'true' ||
        target.getAttribute?.('contentEditable') === 'true'

      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isContentEditable) {
        return
      }

      const handler = handlersRef.current[e.key]
      if (handler) {
        e.preventDefault()
        handler(e)
      }
    },
    [enabled],
  )

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])
}
