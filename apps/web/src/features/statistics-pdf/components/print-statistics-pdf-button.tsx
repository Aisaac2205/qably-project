'use client'

import { CircleNotch, Printer } from '@phosphor-icons/react'
import type { DashboardPeriod } from '@qably/types'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { usePrintStatisticsPdf } from '../hooks/use-print-statistics-pdf'

export interface PrintStatisticsPdfButtonProps {
  readonly period: DashboardPeriod
  readonly projectId?: string
  readonly projectName?: string
}

export function PrintStatisticsPdfButton({ period, projectId, projectName }: PrintStatisticsPdfButtonProps) {
  const { t } = useTranslation()
  const { print, isReady, isGenerating } = usePrintStatisticsPdf({ period, projectId, projectName })
  const Icon = isGenerating ? CircleNotch : Printer

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!isReady || isGenerating}
        focusableWhenDisabled
        aria-busy={isGenerating || undefined}
        aria-label={isGenerating ? undefined : t('statisticsPdf.printAria', { count: period })}
        onClick={() => void print()}
      >
        <Icon
          size={16}
          weight="bold"
          aria-hidden="true"
          className={isGenerating ? 'animate-spin motion-reduce:animate-none' : undefined}
        />
        {isGenerating ? t('statisticsPdf.generating') : t('statisticsPdf.print')}
      </Button>
      <span role="status" className="sr-only">
        {isGenerating ? t('statisticsPdf.generating') : ''}
      </span>
    </>
  )
}
