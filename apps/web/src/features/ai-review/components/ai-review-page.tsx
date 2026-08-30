'use client'

import { useState } from 'react'
import { useAiReview } from '@/features/projects/test-generation/hooks/use-ai-review'
import { useProject } from '@/features/projects/hooks/use-project'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { ReviewCaseList } from './review-case-list'
import { ReviewCaseDetail } from './review-case-detail'
import { ReviewToolbar } from './review-toolbar'
import { CoverageGapsPanel } from './coverage-gaps-panel'
import { ProjectChatPanel } from './project-chat-panel'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'

export function AiReviewPage({ projectId }: { projectId: string }) {
  const { project } = useProject(projectId)
  const {
    cases,
    selectedCase,
    selectCase,
    confirmSelected,
    rejectSelected,
    skipSelected,
  } = useAiReview(projectId)
  const { t } = useTranslation()
  const [tab, setTab] = useState<'review' | 'chat'>('review')
  const [listFilter, setListFilter] = useState<'all' | 'duplicates'>('all')
  const [prefillPrompt, setPrefillPrompt] = useState<string | undefined>(undefined)

  const handleDraftWithAi = (area: string) => {
    setPrefillPrompt(t('aiReview.suggestCases', { area }))
    setTab('chat')
  }

  const handleViewCase = (caseId: string) => {
    selectCase(caseId)
    setListFilter('all')
    setTab('review')
  }

  return (
    <div className="w-full flex-1 flex flex-col h-full min-h-0 space-y-4 p-4 sm:p-6 text-default animate-page-enter">
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: `/projects/${projectId}` }] : []),
          { label: t('aiReview.title') },
        ]}
      />

      {/* Minimalist header with tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 pt-1 pb-0.5">
        <h1 className="sr-only">{t('aiReview.title')}</h1>
        <p className="text-xs sm:text-sm text-muted">
          {cases.length === 1
            ? t('aiReview.casePendingReview', { count: cases.length })
            : t('aiReview.casesPendingReview', { count: cases.length })}
        </p>

        <div
          role="tablist"
          aria-label={t('aiReview.title')}
          className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-canvas/60 border border-border/60 shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'review'}
            onClick={() => setTab('review')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary cursor-pointer ${
              tab === 'review'
                ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                : 'text-muted hover:text-default hover:bg-surface-hover border border-transparent'
            }`}
          >
            {t('aiReview.reviewQueue')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'chat'}
            onClick={() => setTab('chat')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary cursor-pointer ${
              tab === 'chat'
                ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                : 'text-muted hover:text-default hover:bg-surface-hover border border-transparent'
            }`}
          >
            {t('aiReview.projectChat')}
          </button>
        </div>
      </div>

      {tab === 'review' ? (
        cases.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <StateView
              kind="empty"
              title={t('aiReview.noCasesPending')}
              className="p-12"
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden min-h-[580px] h-[700px] max-h-[85vh]">
              <ResizableSplit
                storageKey="ai-review-sidebar"
                defaultWidth={300}
                minWidth={240}
                maxRatio={0.5}
                className="h-full"
                first={
                  <div className="flex flex-col h-full min-h-0 bg-surface">
                    <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-border bg-canvas/30 shrink-0">
                      <button
                        type="button"
                        aria-pressed={listFilter === 'all'}
                        onClick={() => setListFilter('all')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary ${
                          listFilter === 'all'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'text-muted hover:text-default hover:bg-surface-hover'
                        }`}
                      >
                        {t('aiReview.filterAll')}
                      </button>
                      <button
                        type="button"
                        aria-pressed={listFilter === 'duplicates'}
                        onClick={() => setListFilter('duplicates')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary ${
                          listFilter === 'duplicates'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'text-muted hover:text-default hover:bg-surface-hover'
                        }`}
                      >
                        {t('aiReview.filterDuplicates')}
                      </button>
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
                      disabled={!selectedCase}
                      onConfirm={confirmSelected}
                      onReject={rejectSelected}
                      onSkip={skipSelected}
                    />
                  </div>
                }
              />
            </div>

            <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
              <CoverageGapsPanel projectId={projectId} onDraftWithAi={handleDraftWithAi} />
            </div>
          </div>
        )
      ) : (
        <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <ProjectChatPanel
            projectId={projectId}
            onViewCase={handleViewCase}
            onReturnToReview={() => setTab('review')}
            prefillPrompt={prefillPrompt}
          />
        </div>
      )}
    </div>
  )
}
