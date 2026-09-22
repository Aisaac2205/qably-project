'use client'

import { useMemo, useState } from 'react'
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cases: AttachedCaseRecord[]
  excludedIds: string[]
  onSelect: (attachedCase: AttachedCaseRecord) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('aiReview.chatPickerSearchPlaceholder')}
            aria-label={t('aiReview.chatPickerSearchLabel')}
            className="pl-9"
            autoFocus
          />
        </div>

        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-muted">
              {t('aiReview.chatPickerNoResults')}
            </li>
          ) : (
            results.map((attachedCase) => (
              <li key={attachedCase.id}>
                <button
                  type="button"
                  onClick={() => onSelect(attachedCase)}
                  className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-surface-hover transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary/40 cursor-pointer"
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
