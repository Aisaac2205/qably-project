'use client'

import { useRef } from 'react'
import { useSuiteListFilters } from '@/features/projects/suites/hooks/use-suite-list-filters'
import { useSuiteTags } from '@/features/projects/suites/hooks/use-suite-summaries'
import { withActiveTag } from '@/features/projects/suites/lib/suite-filter-options'
import { SuiteListResults } from './suite-list-results'
import { SuiteListToolbar } from './suite-list-toolbar'

interface SuiteListProps {
  projectId: string
}

export function SuiteList({ projectId }: SuiteListProps) {
  const filters = useSuiteListFilters()
  const { tags } = useSuiteTags(projectId)
  const { sort, appliedSearch, status, tag, clearFilters } = filters
  const regionRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={regionRef} className="space-y-3">
      <SuiteListToolbar
        projectId={projectId}
        filters={filters}
        availableTags={withActiveTag(tags, tag)}
      />
      <SuiteListResults
        projectId={projectId}
        filters={{ sort, search: appliedSearch, status, tag }}
        focusRegion={regionRef}
        onClearFilters={clearFilters}
      />
    </div>
  )
}
