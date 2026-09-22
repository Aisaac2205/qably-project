'use client'

import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import type { AttachedCaseRecord } from '@qably/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n'

export function ChatCasePicker({
  open,
  onOpenChange,
  cases,
  excludedIds,
  onSelect,
  atCap = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cases: AttachedCaseRecord[]
  excludedIds: string[]
  onSelect: (attachedCase: AttachedCaseRecord) => void
  atCap?: boolean
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listboxId = useId()

  const results = useMemo(() => {
    const excluded = new Set(excludedIds)
    const normalized = query.trim().toLowerCase()
    return cases
      .filter((attachedCase) => !excluded.has(attachedCase.id))
      .filter(
        (attachedCase) =>
          normalized === '' || attachedCase.name.toLowerCase().includes(normalized),
      )
  }, [cases, excludedIds, query])

  const [previousResults, setPreviousResults] = useState(results)
  if (results !== previousResults) {
    setPreviousResults(results)
    setActiveIndex(0)
  }

  const optionId = (caseId: string) => `${listboxId}-option-${caseId}`
  const activeOption = results[activeIndex]

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (current - 1 + results.length) % results.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(results.length - 1)
    } else if (event.key === 'Enter') {
      if (!activeOption || atCap) return
      event.preventDefault()
      onSelect(activeOption)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setQuery('')
      }}
    >
      <DialogContent className="max-w-md gap-3">
        <DialogHeader>
          <DialogTitle>{t('aiReview.chatPickerTitle')}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            role="combobox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t('aiReview.chatPickerSearchPlaceholder')}
            aria-label={t('aiReview.chatPickerSearchLabel')}
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOption ? optionId(activeOption.id) : undefined}
            className="pl-9"
            autoFocus
          />
        </div>

        <ul id={listboxId} role="listbox" aria-label={t('aiReview.chatPickerTitle')} className="max-h-72 space-y-1 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-muted">
              {t('aiReview.chatPickerNoResults')}
            </li>
          ) : (
            results.map((attachedCase, index) => (
              <li key={attachedCase.id} role="presentation">
                <button
                  id={optionId(attachedCase.id)}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  aria-disabled={atCap || undefined}
                  onClick={() => {
                    if (atCap) return
                    onSelect(attachedCase)
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-surface-hover transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary/40 cursor-pointer aria-disabled:pointer-events-none aria-disabled:opacity-50"
                >
                  <span className="truncate text-sm font-medium text-default">
                    {attachedCase.name}
                  </span>
                  <span className="truncate text-xs text-muted">{attachedCase.suiteName}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
