'use client'

import type { ProposalListItem } from '../api/review.api'
import { countByStatus, filterByStatus, scopeProposals, type ReviewQueueStatusFilter } from '../lib/filter-proposals'
import { Card, CardContent } from '@/components/ui/card'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { useTranslation } from '@/lib/i18n'
import { ReviewInboxFilters } from './review-inbox-filters'
import { ReviewQueueRow } from './review-queue-row'
import { ReviewShortcutsLegend } from './review-shortcuts-legend'

export type { ReviewQueueStatusFilter }

export interface ReviewInboxQueueProps {
  proposals: ProposalListItem[]
  selectedId?: string
  onSelect: (id: string) => void
  selectedProjectId: string
  onSelectProject: (id: string) => void
  statusFilter: ReviewQueueStatusFilter
  onStatusFilterChange: (status: ReviewQueueStatusFilter) => void
  duplicateOnly: boolean
  onToggleDuplicateOnly: () => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
}

export function ReviewInboxQueue({
  proposals,
  selectedId,
  onSelect,
  selectedProjectId,
  onSelectProject,
  statusFilter,
  onStatusFilterChange,
  duplicateOnly,
  onToggleDuplicateOnly,
  searchQuery,
  onSearchQueryChange,
}: ReviewInboxQueueProps) {
  const { t } = useTranslation()
  const { projects } = useProjects()

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]))

  const scopedProposals = scopeProposals(proposals, {
    selectedProjectId,
    duplicateOnly,
    searchQuery,
    projectNameById,
  })
  const statusCounts = countByStatus(scopedProposals)
  const filteredProposals = filterByStatus(scopedProposals, statusFilter)

  return (
    <Card className="rounded-none border-0 h-full flex flex-col justify-between overflow-hidden bg-surface">
      <ReviewInboxFilters
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={onSelectProject}
        duplicateOnly={duplicateOnly}
        onToggleDuplicateOnly={onToggleDuplicateOnly}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        statusCounts={statusCounts}
      />

      <CardContent className="p-0 flex-1 overflow-y-auto">
        {filteredProposals.length === 0 ? (
          <StateView
            kind="empty"
            title={t('reviewInbox.noProposalsFound')}
            description={t('reviewInbox.noProposalsDescription')}
            className="p-8 h-full"
          />
        ) : (
          <EntityList aria-label={t('reviewInbox.queueTitle')}>
            {filteredProposals.map((proposal) => (
              <ReviewQueueRow
                key={proposal.id}
                proposal={proposal}
                isSelected={proposal.id === selectedId}
                onSelect={onSelect}
                projectName={projectNameById.get(proposal.projectId)}
              />
            ))}
          </EntityList>
        )}
      </CardContent>

      <ReviewShortcutsLegend />
    </Card>
  )
}
