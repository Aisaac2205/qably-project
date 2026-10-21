'use client'

import { MagnifyingGlass, CopySimple, X } from '@phosphor-icons/react'
import type { ReviewQueueStatusFilter } from './review-inbox-queue'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { SelectSimple } from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n'

/** Long enough to tell two batches apart, short enough for a chip: a full id is on hover. */
const BATCH_ID_DISPLAY_LENGTH = 8

export interface ReviewInboxFiltersProps {
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  projects: { id: string; name: string }[]
  selectedProjectId: string
  onSelectProject: (id: string) => void
  duplicateOnly: boolean
  onToggleDuplicateOnly: () => void
  statusFilter: ReviewQueueStatusFilter
  onStatusFilterChange: (status: ReviewQueueStatusFilter) => void
  statusCounts: Record<ReviewQueueStatusFilter, number>
  /** False when the counts describe a wider set than the list, for example under a batch filter. */
  showStatusCounts?: boolean
  batchId?: string
  onClearBatch?: () => void
}

export function ReviewInboxFilters({
  searchQuery,
  onSearchQueryChange,
  projects,
  selectedProjectId,
  onSelectProject,
  duplicateOnly,
  onToggleDuplicateOnly,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
  showStatusCounts = true,
  batchId,
  onClearBatch,
}: ReviewInboxFiltersProps) {
  const { t } = useTranslation()

  return (
    <div className="p-3.5 sm:p-4 border-b border-border bg-canvas/30 space-y-3 shrink-0">
      <div className="relative">
        <MagnifyingGlass
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder={t('reviewInbox.searchPlaceholder')}
          aria-label={t('reviewInbox.searchPlaceholder')}
          className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-1.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[130px]">
          <SelectSimple
            options={[
              { value: 'all', label: t('reviewInbox.allProjects') },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
            value={selectedProjectId}
            onValueChange={onSelectProject}
            aria-label={t('reviewInbox.project')}
          />
        </div>

        <button
          type="button"
          aria-pressed={duplicateOnly}
          onClick={onToggleDuplicateOnly}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-[0.98] ${
            duplicateOnly
              ? 'bg-warn-bg text-warn border border-warn/30'
              : 'border border-border bg-surface text-muted hover:text-default'
          }`}
        >
          <CopySimple size={12} weight="bold" aria-hidden="true" />
          <span>{t('reviewInbox.filterDuplicates')}</span>
        </button>
      </div>

      {batchId !== undefined && (
        <div className="flex items-center">
          <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface pl-2.5 pr-1 text-xs text-muted">
            <span>{t('reviewInbox.batchFilter')}</span>
            <span className="truncate font-mono text-default" title={batchId}>
              {batchId.slice(0, BATCH_ID_DISPLAY_LENGTH)}
            </span>
            <button
              type="button"
              onClick={onClearBatch}
              aria-label={t('reviewInbox.clearBatchFilter')}
              className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-default focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={12} weight="bold" aria-hidden="true" />
            </button>
          </span>
        </div>
      )}

      <div className="flex items-center overflow-x-auto pt-0.5">
        <SegmentedControl
          size="sm"
          label={t('reviewInbox.filterStatus')}
          options={(['in_review', 'all', 'approved', 'rejected'] as const).map((status) => ({
            value: status,
            label: (
              <>
                <span>
                  {status === 'in_review'
                    ? t('reviewInbox.filterInReview')
                    : status === 'approved'
                      ? t('reviewInbox.filterApproved')
                      : status === 'rejected'
                        ? t('reviewInbox.filterRejected')
                        : t('reviewInbox.filterAll')}
                </span>
                {showStatusCounts && (
                  <span className="font-mono tabular-nums text-[10px] font-normal opacity-70">
                    {statusCounts[status]}
                  </span>
                )}
              </>
            ),
          }))}
          value={statusFilter}
          onChange={onStatusFilterChange}
        />
      </div>
    </div>
  )
}
