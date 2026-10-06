'use client'

import { memo } from 'react'
import { TestTube, Star } from '@phosphor-icons/react'
import type { SuiteSummary } from '@qably/types'
import { Badge } from '@/components/ui/badge'
import { StatusChip } from '@/components/ui/status-chip'
import { InlineEditableText } from './inline-editable-text'
import { useUpdateSuite } from '@/features/projects/suites/hooks/use-suite-mutations'
import { useTranslation } from '@/lib/i18n'

const STATUS_TONE: Record<string, 'text-pass' | 'text-fail' | 'text-warn' | 'text-running' | 'text-muted'> = {
  pass: 'text-pass',
  fail: 'text-fail',
  running: 'text-running',
  'needs-attention': 'text-warn',
  'never-run': 'text-muted',
}

export type SuiteRowData = Pick<
  SuiteSummary,
  'id' | 'name' | 'description' | 'tags' | 'isDefault' | 'status'
>

interface SuiteRowProps {
  suite: SuiteRowData
}

function SuiteRowImpl({ suite }: SuiteRowProps) {
  const { status } = suite
  const toneClass = STATUS_TONE[status] ?? 'text-muted'
  const { t } = useTranslation()
  const updateSuiteMutation = useUpdateSuite()

  function handleSave(newName: string) {
    updateSuiteMutation.mutate({ id: suite.id, patch: { name: newName } })
  }

  return (
    <div
      className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto] gap-3.5 md:gap-4 items-center py-3.5 px-4 sm:px-5"
      data-testid={`suite-row-${suite.id}`}
    >
      <TestTube
        size={20}
        weight="duotone"
        className={`${toneClass} shrink-0`}
        aria-hidden="true"
      />

      <div className="min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <InlineEditableText
            value={suite.name}
            onSave={handleSave}
            ariaLabel={t('suites.editSuiteName', { name: suite.name })}
          />
          {suite.isDefault && (
            <span
              className="inline-flex items-center text-warn shrink-0"
              title={t('suites.defaultSuite')}
            >
              <Star size={12} weight="fill" aria-hidden="true" />
              <span className="sr-only">{t('suites.defaultSuite')}</span>
            </span>
          )}
        </div>
        {suite.description && (
          <p className="text-xs text-muted truncate text-wrap-pretty mt-0.5">{suite.description}</p>
        )}
        {suite.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {suite.tags.map((tagItem) => (
              <Badge key={tagItem} variant="outline" className="text-xs font-normal">
                {tagItem}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end shrink-0 md:w-32">
        <StatusChip status={status} />
      </div>
    </div>
  )
}

export const SuiteRow = memo(SuiteRowImpl)
