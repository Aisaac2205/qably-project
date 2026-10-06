'use client'

import { useEffect, useState } from 'react'

export function useSpokenMessage(message: string, eventId: number): string {
  const [spokenEventId, setSpokenEventId] = useState<number | null>(null)

  useEffect(() => {
    if (message === '') return

    const frame = requestAnimationFrame(() => setSpokenEventId(eventId))

    return () => cancelAnimationFrame(frame)
  }, [message, eventId])

  return message !== '' && spokenEventId === eventId ? message : ''
}
