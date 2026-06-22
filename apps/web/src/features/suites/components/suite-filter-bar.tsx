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

export type SortKey = 'recent' | 'name' | 'pass-rate' | 'cases'

const STATUS_OPTIONS: Array<{ value: SuiteRunStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'running', label: 'Running' },
  { value: 'needs-attention', label: 'Needs attention' },
  { value: 'never-run', label: 'Never run' },
]

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'recent', label: 'Most recent' },
  { value: 'name', label: 'Name (A→Z)' },
  { value: 'pass-rate', label: 'Highest pass rate' },
  { value: 'cases', label: 'Most cases' },
]

interface SuiteFilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  status: SuiteRunStatus | 'all'
  onStatusChange: (v: SuiteRunStatus | 'all') => void
  tag: string | 'all'
  onTagChange: (v: string | 'all') => void
  sort: SortKey
  onSortChange: (v: SortKey) => void
  availableTags: string[]
}

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
}: SuiteFilterBarProps) {
  return (
    <div
      className="grid grid-cols-2 md:flex md:items-center gap-2"
      role="search"
      aria-label="Filter suites"
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
          placeholder="Search by name or description"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-8 text-sm"
          aria-label="Search suites"
          data-testid="suite-search"
        />
      </div>
      <Select
        value={status}
        onValueChange={(v) => onStatusChange(v as SuiteRunStatus | 'all')}
      >
        <SelectTrigger className="h-8 text-xs w-full md:w-36" aria-label="Status filter">
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
      <Select value={tag} onValueChange={(v) => onTagChange(v)}>
        <SelectTrigger className="h-8 text-xs w-full md:w-36" aria-label="Tag filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tags</SelectItem>
          {availableTags.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
        <SelectTrigger className="h-8 text-xs w-full md:w-36" aria-label="Sort suites">
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
