'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Check } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

interface InlineEditableTextProps {
  value: string
  onSave: (newValue: string) => void
  ariaLabel?: string
}

export function InlineEditableText({ value, onSave, ariaLabel }: InlineEditableTextProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  useEffect(() => {
    setDraft(value)
  }, [value])

  const commit = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      onSave(trimmed)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else if (!trimmed) {
      setDraft(value) // revert on empty
    }
    setIsEditing(false)
  }, [draft, value, onSave])

  const cancel = useCallback(() => {
    setDraft(value)
    setIsEditing(false)
  }, [value])

  if (!isEditing) {
    return (
      <button
        onClick={() => { setDraft(value); setIsEditing(true) }}
        className="text-left hover:bg-canvas rounded px-1 -mx-1 transition-colors text-default cursor-text"
        aria-label={ariaLabel ?? t('suites.editText')}
        type="button"
      >
        {value}
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        onBlur={commit}
        aria-label={ariaLabel ?? t('suites.editText')}
        className="bg-surface border-b border-primary outline-none px-1 -mx-1 text-sm text-default font-inherit w-auto min-w-[100px] max-w-[300px] focus:outline-none"
      />
      <span className="sr-only" aria-live="polite" role="status">
        {saved ? t('suites.saved') : ''}
      </span>
    </span>
  )
}
