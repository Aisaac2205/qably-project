'use client'

import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Translate } from '@phosphor-icons/react'
import type { DocumentFilesResult, DocumentFilesSkipReason } from '@qably/types'
import { AerisIcon } from '@/components/icons/aeris-icon'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'

export type DocumentFilesMode = 'undocumented' | 'stale-locale'

const SKIP_KEYS: Record<DocumentFilesSkipReason, string> = {
  'no-source-file': 'suites.documentFilesSkippedNoSourceFile',
  'already-pending': 'suites.documentFilesSkippedAlreadyPending',
}

const SECONDARY_ACTION_CLASS =
  'inline-flex items-center gap-1.5 text-xs font-semibold text-ai hover:text-ai transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-ai-bg/40 border border-dashed border-ai/40 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70'

const PRIMARY_ACTION_CLASS =
  'text-sm font-semibold text-ai hover:text-ai border-ai/40 bg-ai-bg hover:bg-ai-bg/70 focus-visible:ring-ai/40'

interface DocumentWithAerisProps {
  label: string
  pendingCount: number
  staleCount?: number
  onDocument: (mode: DocumentFilesMode) => Promise<DocumentFilesResult>
  primary?: boolean
}

export function DocumentWithAeris({
  label,
  pendingCount,
  staleCount = 0,
  onDocument,
  primary = false,
}: DocumentWithAerisProps) {
  const { t } = useTranslation()
  const documentation = useMutation({ mutationFn: onDocument })

  if (pendingCount === 0 && staleCount === 0) return null

  const result = documentation.data

  function renderTrigger(mode: DocumentFilesMode, icon: ReactNode, text: ReactNode) {
    const isActive = documentation.isPending && documentation.variables === mode
    const content = (
      <>
        {icon}
        {isActive ? t('suites.documentingFiles') : text}
      </>
    )

    if (primary) {
      return (
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={() => documentation.mutate(mode)}
          disabled={documentation.isPending}
          className={PRIMARY_ACTION_CLASS}
        >
          {content}
        </Button>
      )
    }

    return (
      <button
        type="button"
        onClick={() => documentation.mutate(mode)}
        disabled={documentation.isPending}
        className={SECONDARY_ACTION_CLASS}
      >
        {content}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {pendingCount > 0 &&
          renderTrigger('undocumented', <AerisIcon size={primary ? 16 : 14} />, label)}
        {staleCount > 0 &&
          renderTrigger(
            'stale-locale',
            <Translate size={primary ? 14 : 13} weight="bold" aria-hidden="true" />,
            t('suites.redocumentStale', { count: staleCount }),
          )}
      </div>

      <div className="min-h-5 flex flex-col items-end gap-1 text-right">
        {result === undefined && !documentation.isError && pendingCount > 0 && (
          <p className="text-xs text-muted">
            {t('suites.documentFilesPending', { count: pendingCount })}
          </p>
        )}

        {result !== undefined && (
          <>
            <p role="status" className="text-xs font-medium text-ai">
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
          </>
        )}

        {documentation.isError && (
          <p role="alert" className="text-xs font-medium text-fail">
            {t('suites.documentFilesError')}
          </p>
        )}
      </div>
    </div>
  )
}
