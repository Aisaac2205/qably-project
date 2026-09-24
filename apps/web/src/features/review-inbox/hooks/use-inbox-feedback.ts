'use client'

import { useCallback, useState } from 'react'

export interface InboxFeedbackToast {
  message: string
  type: 'success' | 'info' | 'error'
  href?: string
  linkLabel?: string
}

export interface UseInboxFeedbackResult {
  toast: InboxFeedbackToast | null
  dismiss: () => void
  showSuccess: (message: string, link?: { href: string; linkLabel: string }) => void
  showInfo: (message: string) => void
  showError: (message: string) => void
}

export function useInboxFeedback(): UseInboxFeedbackResult {
  const [toast, setToast] = useState<InboxFeedbackToast | null>(null)

  const dismiss = useCallback(() => setToast(null), [])

  const showSuccess = useCallback(
    (message: string, link?: { href: string; linkLabel: string }) => {
      setToast({ message, type: 'success', ...(link ?? {}) })
    },
    [],
  )

  const showInfo = useCallback((message: string) => {
    setToast({ message, type: 'info' })
  }, [])

  const showError = useCallback((message: string) => {
    setToast({ message, type: 'error' })
  }, [])

  return { toast, dismiss, showSuccess, showInfo, showError }
}
