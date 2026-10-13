'use client'

import { CircleNotch, FilePdf } from '@phosphor-icons/react'
import type { DashboardPeriod } from '@qably/types'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { useDownloadStatisticsPdf } from '../hooks/use-download-statistics-pdf'

export interface DownloadStatisticsPdfButtonProps {
  readonly period: DashboardPeriod
  readonly projectId?: string
  readonly projectName?: string
}

export function DownloadStatisticsPdfButton({ period, projectId, projectName }: DownloadStatisticsPdfButtonProps) {
  const { t } = useTranslation()
  const { download, isReady, isGenerating } = useDownloadStatisticsPdf({ period, projectId, projectName })
  const Icon = isGenerating ? CircleNotch : FilePdf

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!isReady || isGenerating}
        focusableWhenDisabled
        aria-busy={isGenerating || undefined}
        aria-label={isGenerating ? undefined : t('statisticsPdf.downloadAria', { count: period })}
        onClick={() => void download()}
      >
        <Icon
          size={16}
          weight="bold"
          aria-hidden="true"
          className={isGenerating ? 'animate-spin motion-reduce:animate-none' : undefined}
        />
        {isGenerating ? t('statisticsPdf.generating') : t('statisticsPdf.download')}
      </Button>
      <span role="status" className="sr-only">
        {isGenerating ? t('statisticsPdf.generating') : ''}
      </span>
    </>
  )
}
