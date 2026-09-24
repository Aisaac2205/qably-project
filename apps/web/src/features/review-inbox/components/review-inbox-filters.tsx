'use client'

import { MagnifyingGlass, CopySimple } from '@phosphor-icons/react'
import type { ReviewQueueStatusFilter } from '../lib/filter-proposals'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useTranslation } from '@/lib/i18n'

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
          <select
            value={selectedProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            aria-label={t('reviewInbox.project')}
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-default focus:border-primary focus:outline-none"
          >
            <option value="all">{t('reviewInbox.allProjects')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
                <span className="font-mono tabular-nums text-[10px] font-normal opacity-70">
                  {statusCounts[status]}
                </span>
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
