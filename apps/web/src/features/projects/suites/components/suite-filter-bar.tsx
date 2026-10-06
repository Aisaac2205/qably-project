'use client'

import type { RefObject } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { FilterBar } from '@/components/ui/filter-bar'
import AnimatedDropdown from '@/components/ui/animated-dropdown'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  buildSortOptions,
  buildStatusOptions,
  buildTagOptions,
  optionLabel,
  type SortKey,
  type StatusFilter,
  type TagFilter,
} from '@/features/projects/suites/lib/suite-filter-options'
import { SUITE_SEARCH_MAX_LENGTH } from '@/features/projects/suites/lib/suite-summaries-query'

export type { SortKey }

export function SuiteFilterBar({
  search,
  onSearchChange,
  searchRef,
  status,
  onStatusChange,
  tag,
  onTagChange,
  sort,
  onSortChange,
  availableTags,
  className,
}: {
  search: string
  onSearchChange: (v: string) => void
  searchRef?: RefObject<HTMLInputElement | null>
  status: StatusFilter
  onStatusChange: (v: StatusFilter) => void
  tag: TagFilter
  onTagChange: (v: TagFilter) => void
  sort: SortKey
  onSortChange: (v: SortKey) => void
  availableTags: string[]
  className?: string
}) {
  const { t } = useTranslation()

  const statusOptions = buildStatusOptions(t)
  const tagOptions = buildTagOptions(t, availableTags)
  const sortOptions = buildSortOptions(t)

  return (
    <FilterBar
      label={t('suites.ariaFilterSuites')}
      className={cn('flex flex-col gap-2 md:flex-row md:items-center', className)}
    >
      <div className="relative w-full md:flex-1">
        <MagnifyingGlass
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          weight="bold"
          aria-hidden="true"
        />
        <Input
          ref={searchRef}
          type="search"
          inputMode="search"
          maxLength={SUITE_SEARCH_MAX_LENGTH}
          placeholder={t('suites.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-11 pl-8 text-sm md:h-10"
          aria-label={t('suites.ariaSearchSuites')}
          data-testid="suite-search"
        />
      </div>

      <div className="hidden md:flex md:items-center md:gap-2">
        <AnimatedDropdown
          align="right"
          aria-label={t('suites.ariaStatusFilter')}
          text={optionLabel(statusOptions, status)}
          items={statusOptions.map((opt) => ({
            name: opt.label,
            value: opt.value,
            active: status === opt.value,
            onClick: () => onStatusChange(opt.value),
          }))}
        />

        <AnimatedDropdown
          align="right"
          aria-label={t('suites.ariaTagFilter')}
          text={optionLabel(tagOptions, tag)}
          items={tagOptions.map((opt) => ({
            name: opt.label,
            value: opt.value,
            active: tag === opt.value,
            onClick: () => onTagChange(opt.value),
          }))}
        />

        <AnimatedDropdown
          align="right"
          aria-label={t('suites.ariaSortSuites')}
          text={optionLabel(sortOptions, sort)}
          items={sortOptions.map((opt) => ({
            name: opt.label,
            value: opt.value,
            active: sort === opt.value,
            onClick: () => onSortChange(opt.value),
          }))}
        />
      </div>
    </FilterBar>
  )
}
