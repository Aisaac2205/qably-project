'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

export interface InboxFeedbackLink {
  href: string
  linkLabel: string
}

export interface InboxFeedbackToast {
  id: number
  message: string
  type: 'success' | 'info' | 'error'
  key?: string
  href?: string
  linkLabel?: string
}

export interface ShowErrorOptions {
  key?: string
  link?: InboxFeedbackLink
}

export interface UseInboxFeedbackResult {
  notice: InboxFeedbackToast | null
  errors: InboxFeedbackToast[]
  showSuccess: (message: string, link?: InboxFeedbackLink) => void
  showInfo: (message: string) => void
  showError: (message: string, options?: ShowErrorOptions) => void
  clearError: (key: string) => void
  dismiss: (id: number) => void
  dismissMany: (ids: readonly number[]) => void
}

export function useInboxFeedback(): UseInboxFeedbackResult {
  const [notice, setNotice] = useState<InboxFeedbackToast | null>(null)
  const [errors, setErrors] = useState<InboxFeedbackToast[]>([])
  const nextIdRef = useRef(0)

  const nextId = useCallback(() => {
    nextIdRef.current += 1
    return nextIdRef.current
  }, [])

  const showSuccess = useCallback(
    (message: string, link?: InboxFeedbackLink) => {
      setNotice({ id: nextId(), message, type: 'success', ...(link ?? {}) })
    },
    [nextId],
  )

  const showInfo = useCallback(
    (message: string) => {
      setNotice({ id: nextId(), message, type: 'info' })
    },
    [nextId],
  )

  const showError = useCallback(
    (message: string, options: ShowErrorOptions = {}) => {
      const { key, link } = options
      const error: InboxFeedbackToast = {
        id: nextId(),
        message,
        type: 'error',
        ...(key === undefined ? {} : { key }),
        ...(link ?? {}),
      }
      setErrors((current) => [
        ...(key === undefined ? current : current.filter((item) => item.key !== key)),
        error,
      ])
    },
    [nextId],
  )

  const clearError = useCallback((key: string) => {
    setErrors((current) =>
      current.some((item) => item.key === key)
        ? current.filter((item) => item.key !== key)
        : current,
    )
  }, [])

  const dismiss = useCallback((id: number) => {
    setNotice((current) => (current?.id === id ? null : current))
    setErrors((current) =>
      current.some((item) => item.id === id) ? current.filter((item) => item.id !== id) : current,
    )
  }, [])

  const dismissMany = useCallback((ids: readonly number[]) => {
    setErrors((current) =>
      current.some((item) => ids.includes(item.id))
        ? current.filter((item) => !ids.includes(item.id))
        : current,
    )
  }, [])

  return useMemo(
    () => ({ notice, errors, showSuccess, showInfo, showError, clearError, dismiss, dismissMany }),
    [notice, errors, showSuccess, showInfo, showError, clearError, dismiss, dismissMany],
  )
}
