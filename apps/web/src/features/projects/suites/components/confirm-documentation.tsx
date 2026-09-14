'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { SealCheck } from '@phosphor-icons/react'
import type { ConfirmDocumentationResult, TestCase } from '@qably/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { useTranslation } from '@/lib/i18n'
import { describeCase } from '@/features/projects/suites/lib/case-title'

export function useConfirmDocumentationState(
  onConfirm: (caseIds: string[]) => Promise<ConfirmDocumentationResult>,
) {
  return useMutation({ mutationFn: onConfirm })
}

export type ConfirmDocumentationMutation = ReturnType<
  typeof useConfirmDocumentationState
>

interface ConfirmDocumentationProps {
  cases: TestCase[]
  confirmation: ConfirmDocumentationMutation
}

function SelectAllCheckbox({
  state,
  onChange,
}: {
  state: 'all' | 'some' | 'none'
  onChange: () => void
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some'
  }, [state])

  return (
    <label className="flex min-h-6 items-center gap-2 px-3 py-2 border-b border-border text-xs font-semibold text-muted">
      <input
        ref={ref}
        type="checkbox"
        className="size-4"
        checked={state === 'all'}
        aria-checked={state === 'some' ? 'mixed' : state === 'all'}
        onChange={onChange}
      />
      {t('suites.confirmDocumentationSelectAll')}
    </label>
  )
}

export function ConfirmDocumentation({ cases, confirmation }: ConfirmDocumentationProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  if (cases.length === 0) return null

  const count = cases.length
  const selectedCount = selectedIds.size
  const selectionState: 'all' | 'some' | 'none' =
    selectedCount === 0 ? 'none' : selectedCount === cases.length ? 'all' : 'some'

  function openDialog() {
    setSelectedIds(new Set(cases.map((testCase) => testCase.id)))
    setOpen(true)
  }

  function toggleCase(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((previous) =>
      previous.size === cases.length ? new Set() : new Set(cases.map((testCase) => testCase.id)),
    )
  }

  function handleConfirm() {
    confirmation.mutate(Array.from(selectedIds), {
      onSuccess: () => setOpen(false),
    })
  }

  return (
    <>
      <Button type="button" size="default" onClick={openDialog} className="text-sm font-semibold">
        <SealCheck size={14} weight="bold" aria-hidden="true" />
        {t('suites.confirmDocumentationAction', { count })}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('suites.confirmDocumentationTitle', { count })}</DialogTitle>
              <DialogDescription>{t('suites.confirmDocumentationHint')}</DialogDescription>
            </DialogHeader>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border text-sm text-default">
              <SelectAllCheckbox state={selectionState} onChange={toggleAll} />
              <ul className="divide-y divide-border">
                {cases.map((testCase) => (
                  <li key={testCase.id}>
                    <label className="flex min-h-6 items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0"
                        checked={selectedIds.has(testCase.id)}
                        onChange={() => toggleCase(testCase.id)}
                      />
                      <span className="truncate">{describeCase(testCase).title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={confirmation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={confirmation.isPending || selectedCount === 0}
              >
                {confirmation.isPending && <Spinner className="mr-1.5" />}
                {confirmation.isPending
                  ? t('suites.confirmingDocumentation')
                  : t('suites.confirmDocumentationAction', { count: selectedCount })}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
