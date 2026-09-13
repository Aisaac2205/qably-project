'use client'

import { useMutation } from '@tanstack/react-query'
import { SealCheck } from '@phosphor-icons/react'
import type { ConfirmDocumentationResult } from '@qably/types'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'

export function useConfirmDocumentationState(
  onConfirm: () => Promise<ConfirmDocumentationResult>,
) {
  return useMutation({ mutationFn: onConfirm })
}

export type ConfirmDocumentationMutation = ReturnType<
  typeof useConfirmDocumentationState
>

interface ConfirmDocumentationProps {
  pendingCount: number
  confirmation: ConfirmDocumentationMutation
}

export function ConfirmDocumentation({
  pendingCount,
  confirmation,
}: ConfirmDocumentationProps) {
  const { t } = useTranslation()
  const outcome = confirmation.data

  if (pendingCount === 0 && outcome === undefined && !confirmation.isError) {
    return null
  }

  return (
    <div className="rounded-xl border border-ai/40 bg-ai-bg/50 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <SealCheck
            size={16}
            weight="bold"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-ai"
          />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-default">
              {t('suites.confirmDocumentationTitle', { count: pendingCount })}
            </p>
            <p className="text-xs text-muted">{t('suites.confirmDocumentationHint')}</p>
          </div>
        </div>

        {pendingCount > 0 && (
          <Button
            type="button"
            size="default"
            onClick={() => confirmation.mutate()}
            disabled={confirmation.isPending}
            className="text-sm font-semibold"
          >
            {confirmation.isPending
              ? t('suites.confirmingDocumentation')
              : t('suites.confirmDocumentationAction')}
          </Button>
        )}
      </div>

      {confirmation.isError && (
        <p role="alert" className="mt-2.5 text-xs font-medium text-fail">
          {t('suites.confirmDocumentationError')}
        </p>
      )}

      {outcome !== undefined && (
        <div className="mt-2.5 space-y-0.5">
          <p role="status" className="text-xs font-medium text-ai">
            {t('suites.confirmDocumentationDone', { count: outcome.confirmedCount })}
          </p>
          {outcome.skippedCount > 0 && (
            <p className="text-xs text-muted">
              {t('suites.confirmDocumentationSkipped', { count: outcome.skippedCount })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
