'use client'

/**
 * SuiteFilterBar — controlled filter UI for the suites list.
 *
 * Single row on desktop, 2x2 grid on mobile. Owns no state; the parent
 * (`SuiteList`) controls the values via props and onChange handlers.
 *
 * Uses the global `Input` and `Select` primitives (tokenized via OKLCH).
 */
import { MagnifyingGlass } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SuiteRunStatus } from '@qably/types'
import { useTranslation } from '@/lib/i18n'

export type SortKey = 'recent' | 'name' | 'pass-rate' | 'cases'

export function SuiteFilterBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  tag,
  onTagChange,
  sort,
  onSortChange,
  availableTags,
}: {
  search: string
  onSearchChange: (v: string) => void
  status: SuiteRunStatus | 'all'
  onStatusChange: (v: SuiteRunStatus | 'all') => void
  tag: string | 'all'
  onTagChange: (v: string | 'all') => void
  sort: SortKey
  onSortChange: (v: SortKey) => void
  availableTags: string[]
}) {
  const { t } = useTranslation()
  
  const STATUS_OPTIONS: Array<{ value: SuiteRunStatus | 'all'; label: string }> = [
    { value: 'all', label: t('suites.filterAllStatuses') },
    { value: 'pass', label: t('common.pass') },
    { value: 'fail', label: t('common.fail') },
    { value: 'running', label: t('common.running') },
    { value: 'needs-attention', label: t('suites.filterNeedsAttention') },
    { value: 'never-run', label: t('suites.filterNeverRun') },
  ]

  const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
    { value: 'recent', label: t('suites.sortMostRecent') },
    { value: 'name', label: t('suites.sortName') },
    { value: 'pass-rate', label: t('suites.sortHighestPassRate') },
    { value: 'cases', label: t('suites.sortMostCases') },
  ]

  return (
    <div
      className="grid grid-cols-2 md:flex md:items-center gap-2"
      role="search"
      aria-label={t('suites.ariaFilterSuites')}
    >
      <div className="relative col-span-2 md:flex-1">
        <MagnifyingGlass
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          weight="bold"
          aria-hidden="true"
        />
        <Input
          type="search"
          inputMode="search"
          placeholder={t('suites.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-8 text-sm"
          aria-label={t('suites.ariaSearchSuites')}
          data-testid="suite-search"
        />
      </div>
      <Select
        value={status}
        onValueChange={(v) => onStatusChange(v as SuiteRunStatus | 'all')}
      >
        <SelectTrigger className="h-8 text-xs w-full md:w-36" aria-label={t('suites.ariaStatusFilter')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={tag} onValueChange={(v) => onTagChange(String(v))}>
        <SelectTrigger className="h-8 text-xs w-full md:w-36" aria-label={t('suites.ariaTagFilter')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('suites.allTags')}</SelectItem>
          {availableTags.map((tagItem) => (
            <SelectItem key={tagItem} value={tagItem}>
              {tagItem}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
        <SelectTrigger className="h-8 text-xs w-full md:w-36" aria-label={t('suites.ariaSortSuites')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
