'use client'

import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Translate } from '@phosphor-icons/react'
import type { DocumentFilesResult } from '@qably/types'
import { AerisIcon } from '@/components/icons/aeris-icon'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useTranslation } from '@/lib/i18n'

export type DocumentFilesMode = 'undocumented' | 'stale-locale'

const SECONDARY_ACTION_CLASS =
  'inline-flex items-center gap-1.5 text-xs font-semibold text-ai hover:text-ai transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-ai-bg/40 border border-dashed border-ai/40 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70'

const PRIMARY_ACTION_CLASS =
  'text-sm font-semibold text-ai hover:text-ai border-ai/40 bg-ai-bg hover:bg-ai-bg/70 focus-visible:ring-ai/40'

export function useDocumentFiles(onDocument: (mode: DocumentFilesMode) => Promise<DocumentFilesResult>) {
  return useMutation({ mutationFn: onDocument })
}

export type DocumentFilesMutation = ReturnType<typeof useDocumentFiles>

interface DocumentWithAerisProps {
  label: string
  pendingCount: number
  staleCount?: number
  documentation: DocumentFilesMutation
  primary?: boolean
  activeMode?: DocumentFilesMode
}

export function DocumentWithAeris({
  label,
  pendingCount,
  staleCount = 0,
  documentation,
  primary = false,
  activeMode,
}: DocumentWithAerisProps) {
  const { t } = useTranslation()

  if (pendingCount === 0 && staleCount === 0) return null

  const busy = documentation.isPending || activeMode !== undefined

  function renderTrigger(mode: DocumentFilesMode, icon: ReactNode, text: ReactNode) {
    const isActive =
      (documentation.isPending && documentation.variables === mode) || activeMode === mode
    const content = (
      <>
        {isActive ? <Spinner size={primary ? 'md' : 'sm'} /> : icon}
        {isActive ? t('suites.documentingFiles') : text}
      </>
    )

    if (primary) {
      return (
        <Button
          key={mode}
          type="button"
          variant="outline"
          size="default"
          onClick={() => documentation.mutate(mode)}
          disabled={busy}
          className={PRIMARY_ACTION_CLASS}
        >
          {content}
        </Button>
      )
    }

    return (
      <button
        key={mode}
        type="button"
        onClick={() => documentation.mutate(mode)}
        disabled={busy}
        className={SECONDARY_ACTION_CLASS}
      >
        {content}
      </button>
    )
  }

  const showUndocumented = pendingCount > 0
  const showStale = staleCount > 0

  if (showUndocumented && showStale) {
    return (
      <div className="flex items-center gap-2">
        {renderTrigger('undocumented', <AerisIcon size={primary ? 16 : 14} />, label)}
        {renderTrigger(
          'stale-locale',
          <Translate size={primary ? 14 : 13} weight="bold" aria-hidden="true" />,
          t('suites.redocumentStale', { count: staleCount }),
        )}
      </div>
    )
  }

  if (showUndocumented) {
    return renderTrigger('undocumented', <AerisIcon size={primary ? 16 : 14} />, label)
  }

  return renderTrigger(
    'stale-locale',
    <Translate size={primary ? 14 : 13} weight="bold" aria-hidden="true" />,
    t('suites.redocumentStale', { count: staleCount }),
  )
}
