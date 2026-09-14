'use client'

import { useState } from 'react'
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
  onConfirm: () => Promise<ConfirmDocumentationResult>,
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

export function ConfirmDocumentation({ cases, confirmation }: ConfirmDocumentationProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  if (cases.length === 0) return null

  const count = cases.length

  function handleConfirm() {
    confirmation.mutate(undefined, {
      onSuccess: () => setOpen(false),
    })
  }

  return (
    <>
      <Button type="button" size="default" onClick={() => setOpen(true)} className="text-sm font-semibold">
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

            <ul className="max-h-64 overflow-y-auto divide-y divide-border rounded-lg border border-border text-sm text-default">
              {cases.map((testCase) => (
                <li key={testCase.id} className="truncate px-3 py-2">
                  {describeCase(testCase).title}
                </li>
              ))}
            </ul>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={confirmation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={confirmation.isPending}>
                {confirmation.isPending && <Spinner className="mr-1.5" />}
                {confirmation.isPending
                  ? t('suites.confirmingDocumentation')
                  : t('suites.confirmDocumentationAction', { count })}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
