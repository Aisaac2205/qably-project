'use client'

import { useMutation } from '@tanstack/react-query'
import { Sparkle } from '@phosphor-icons/react'
import type { DocumentFilesResult, DocumentFilesSkipReason } from '@qably/types'
import { useTranslation } from '@/lib/i18n'

const SKIP_KEYS: Record<DocumentFilesSkipReason, string> = {
  'no-source-file': 'suites.documentFilesSkippedNoSourceFile',
  'already-pending': 'suites.documentFilesSkippedAlreadyPending',
}

interface DocumentWithAerisProps {
  label: string
  pendingCount: number
  onDocument: () => Promise<DocumentFilesResult>
}

export function DocumentWithAeris({
  label,
  pendingCount,
  onDocument,
}: DocumentWithAerisProps) {
  const { t } = useTranslation()
  const documentation = useMutation({ mutationFn: onDocument })

  if (pendingCount === 0) return null

  const result = documentation.data

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={() => documentation.mutate()}
        disabled={documentation.isPending}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ai hover:text-ai transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-ai-bg/40 border border-dashed border-ai/40 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Sparkle size={13} weight="bold" aria-hidden="true" />
        {documentation.isPending ? t('suites.documentingFiles') : label}
      </button>

      {result === undefined && !documentation.isError && (
        <p className="text-xs text-muted text-right">
          {t('suites.documentFilesPending', { count: pendingCount })}
        </p>
      )}

      {result !== undefined && (
        <div className="flex flex-col items-end gap-1 text-right">
          <p role="status" className="text-xs text-ai">
            {result.filesEnqueued === 0
              ? t('suites.documentFilesNothingToDo')
              : t('suites.documentFilesQueued', {
                  cases: result.casesTargeted,
                  files: result.filesEnqueued,
                })}
          </p>
          {result.casesSkipped.map((skip) => (
            <p key={skip.reason} className="text-xs text-muted">
              {t(SKIP_KEYS[skip.reason], { count: skip.count })}
            </p>
          ))}
        </div>
      )}

      {documentation.isError && (
        <p role="alert" className="text-xs text-fail text-right">
          {t('suites.documentFilesError')}
        </p>
      )}
    </div>
  )
}
