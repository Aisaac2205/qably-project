'use client'

import { useState } from 'react'
import { useAiReview } from '@/features/projects/test-generation/hooks/use-ai-review'
import { useProject } from '@/features/projects/hooks/use-project'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { ReviewCaseList } from './review-case-list'
import { ReviewCaseDetail } from './review-case-detail'
import { ReviewToolbar } from './review-toolbar'
import { ProjectChatPanel } from './project-chat-panel'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { projectRootPath } from '@/features/projects/lib/routes'

export function AiReviewPage({ projectId }: { projectId: string }) {
  const { project } = useProject(projectId)
  const {
    cases,
    selectedCase,
    isLoading,
    isError,
    isDeciding,
    decisionError,
    selectCase,
    confirmSelected,
    rejectSelected,
    skipSelected,
  } = useAiReview(projectId)
  const { t } = useTranslation()
  const [tab, setTab] = useState<'review' | 'chat'>('review')
  const [listFilter, setListFilter] = useState<'all' | 'duplicates'>('all')

  return (
    <div className="w-full flex-1 flex flex-col h-full min-h-0 space-y-4 p-4 sm:p-6 text-default animate-page-enter">
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
          { label: t('aiReview.title') },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 pt-1 pb-0.5">
        <h1 className="sr-only">{t('aiReview.title')}</h1>
        <p className="text-xs sm:text-sm text-muted">
          {cases.length === 1
            ? t('aiReview.casePendingReview', { count: cases.length })
            : t('aiReview.casesPendingReview', { count: cases.length })}
        </p>

        <SegmentedControl
          className="shrink-0"
          label={t('aiReview.title')}
          semantics="tabs"
          options={[
            {
              value: 'review' as const,
              label: t('aiReview.reviewQueue'),
              id: 'ai-review-tab-review',
              controls: 'ai-review-panel-review',
            },
            {
              value: 'chat' as const,
              label: t('aiReview.projectChat'),
              id: 'ai-review-tab-chat',
              controls: 'ai-review-panel-chat',
            },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div
        id="ai-review-panel-review"
        role="tabpanel"
        aria-labelledby="ai-review-tab-review"
        hidden={tab !== 'review'}
        className="flex-1 min-h-0"
      >
        {isLoading ? (
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <StateView kind="loading" title={t('aiReview.loading')} className="p-12" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <StateView kind="error" title={t('aiReview.loadError')} className="p-12" />
          </div>
        ) : cases.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <StateView
              kind="empty"
              title={t('aiReview.noCasesPending')}
              className="p-12"
            />
          </div>
        ) : (
          <div className="flex flex-col h-full min-h-0 space-y-4">
            <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden min-h-[580px] h-[700px] max-h-[85vh]">
              <ResizableSplit
                storageKey="ai-review-sidebar"
                defaultWidth={300}
                minWidth={240}
                maxRatio={0.5}
                className="h-full"
                first={
                  <div className="flex flex-col h-full min-h-0 bg-surface">
                    <div className="flex items-center px-3 py-2.5 border-b border-border bg-canvas/30 shrink-0">
                      <SegmentedControl
                        size="sm"
                        label={t('aiReview.filterCases')}
                        options={[
                          { value: 'all' as const, label: t('aiReview.filterAll') },
                          {
                            value: 'duplicates' as const,
                            label: t('aiReview.filterDuplicates'),
                          },
                        ]}
                        value={listFilter}
                        onChange={setListFilter}
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                      <ReviewCaseList
                        proposals={cases}
                        selectedId={selectedCase?.id}
                        onSelect={selectCase}
                        filter={listFilter}
                      />
                    </div>
                  </div>
                }
                second={
                  <div className="flex flex-col h-full min-h-0 bg-surface">
                    <div className="flex-1 overflow-y-auto min-h-0">
                      {selectedCase ? (
                        <ReviewCaseDetail proposal={selectedCase} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted p-8 text-center">
                          {t('aiReview.selectCaseToReview')}
                        </div>
                      )}
                    </div>
                    <ReviewToolbar
                      disabled={!selectedCase || isDeciding}
                      decisionError={decisionError}
                      onConfirm={confirmSelected}
                      onReject={rejectSelected}
                      onSkip={skipSelected}
                    />
                  </div>
                }
              />
            </div>
          </div>
        )}
      </div>

      <div
        id="ai-review-panel-chat"
        role="tabpanel"
        aria-labelledby="ai-review-tab-chat"
        hidden={tab !== 'chat'}
        className="flex-1 min-h-0 -mx-4 -mb-4 sm:mx-0 sm:mb-0"
      >
        <div className="flex flex-col h-full min-h-0 border-y border-border bg-surface overflow-hidden sm:rounded-xl sm:border sm:shadow-card">
          <ProjectChatPanel projectId={projectId} />
        </div>
      </div>
    </div>
  )
}
