'use client'

import { useMutation } from '@tanstack/react-query'
import { Translate } from '@phosphor-icons/react'
import type { DocumentFilesResult, DocumentFilesSkipReason } from '@qably/types'
import { AerisIcon } from '@/components/icons/aeris-icon'
import { useTranslation } from '@/lib/i18n'

export type DocumentFilesMode = 'undocumented' | 'stale-locale'

const SKIP_KEYS: Record<DocumentFilesSkipReason, string> = {
  'no-source-file': 'suites.documentFilesSkippedNoSourceFile',
  'already-pending': 'suites.documentFilesSkippedAlreadyPending',
}

const ACTION_CLASS =
  'inline-flex items-center gap-1.5 text-xs font-semibold text-ai hover:text-ai transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-ai-bg/40 border border-dashed border-ai/40 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70'

interface DocumentWithAerisProps {
  label: string
  pendingCount: number
  staleCount?: number
  onDocument: (mode: DocumentFilesMode) => Promise<DocumentFilesResult>
}

export function DocumentWithAeris({
  label,
  pendingCount,
  staleCount = 0,
  onDocument,
}: DocumentWithAerisProps) {
  const { t } = useTranslation()
  const documentation = useMutation({ mutationFn: onDocument })

  if (pendingCount === 0 && staleCount === 0) return null

  const result = documentation.data

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={() => documentation.mutate('undocumented')}
            disabled={documentation.isPending}
            className={ACTION_CLASS}
          >
            <AerisIcon size={14} />
            {documentation.isPending && documentation.variables === 'undocumented'
              ? t('suites.documentingFiles')
              : label}
          </button>
        )}
        {staleCount > 0 && (
          <button
            type="button"
            onClick={() => documentation.mutate('stale-locale')}
            disabled={documentation.isPending}
            className={ACTION_CLASS}
          >
            <Translate size={13} weight="bold" aria-hidden="true" />
            {documentation.isPending && documentation.variables === 'stale-locale'
              ? t('suites.documentingFiles')
              : t('suites.redocumentStale', { count: staleCount })}
          </button>
        )}
      </div>

      {result === undefined && !documentation.isError && pendingCount > 0 && (
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
