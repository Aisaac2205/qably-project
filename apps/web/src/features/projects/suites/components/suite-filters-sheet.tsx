'use client'

import { useState } from 'react'
import { FadersHorizontal } from '@phosphor-icons/react'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button, buttonVariants } from '@/components/ui/button'
import { SelectSimple } from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  buildSortOptions,
  buildStatusOptions,
  buildTagOptions,
  countActiveFilters,
  type SortKey,
  type StatusFilter,
  type TagFilter,
} from '@/features/projects/suites/lib/suite-filter-options'

export function SuiteFiltersSheet({
  status,
  onStatusChange,
  tag,
  onTagChange,
  sort,
  onSortChange,
  availableTags,
  className,
}: {
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
  const [open, setOpen] = useState(false)

  const statusOptions = buildStatusOptions(t)
  const tagOptions = buildTagOptions(t, availableTags)
  const sortOptions = buildSortOptions(t)
  const activeCount = countActiveFilters(status, tag)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            data-testid="suite-filters-trigger"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-11 w-full gap-2 px-4 text-sm',
              className,
            )}
          />
        }
      >
        <FadersHorizontal size={16} weight="bold" aria-hidden="true" />
        {t('suites.filters')}
        {activeCount > 0 && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold tabular-nums text-primary-foreground">
            {activeCount}
          </span>
        )}
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className={cn(
          'gap-0 bg-surface text-default',
          'data-[side=bottom]:inset-0 data-[side=bottom]:h-full data-[side=bottom]:border-t-0',
        )}
      >
        <SheetHeader className="border-b border-border px-4 py-3.5">
          <SheetTitle>{t('suites.filters')}</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">
              {t('suites.statusLabel')}
            </span>
            <SelectSimple
              options={statusOptions}
              value={status}
              onValueChange={(value) => onStatusChange(value as StatusFilter)}
              triggerClassName="h-11 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">{t('suites.tagsLabel')}</span>
            <SelectSimple
              options={tagOptions}
              value={tag}
              onValueChange={(value) => onTagChange(value as TagFilter)}
              triggerClassName="h-11 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">{t('suites.sortLabel')}</span>
            <SelectSimple
              options={sortOptions}
              value={sort}
              onValueChange={(value) => onSortChange(value as SortKey)}
              triggerClassName="h-11 text-sm"
            />
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-border">
          {activeCount > 0 && (
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={() => {
                onStatusChange('all')
                onTagChange('all')
              }}
            >
              {t('common.clearFilters')}
            </Button>
          )}
          <SheetClose
            render={<Button type="button" className="h-11 flex-1" />}
          >
            {t('suites.applyFilters')}
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
