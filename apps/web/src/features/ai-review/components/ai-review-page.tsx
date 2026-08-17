'use client'

import { useState } from 'react'
import { useAiReview } from '@/features/projects/test-generation/hooks/use-ai-review'
import { useProject } from '@/lib/use-mock-store'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { ReviewCaseList } from './review-case-list'
import { ReviewCaseDetail } from './review-case-detail'
import { ReviewToolbar } from './review-toolbar'
import { CoverageGapsPanel } from './coverage-gaps-panel'
import { ProjectChatPanel } from './project-chat-panel'
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'

export function AiReviewPage({ projectId }: { projectId: string }) {
  const project = useProject(projectId)
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
    <div className="max-w-5xl 2xl:max-w-6xl mx-auto p-4 md:p-6 space-y-6 animate-page-enter">
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: `/projects/${projectId}` }] : []),
          { label: t('aiReview.title') },
        ]}
      />

      {/* Hero card with page title & tabs */}
      <header className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-default text-wrap-balance">
            {t('aiReview.title')}
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            {cases.length === 1
              ? t('aiReview.casePendingReview', { count: cases.length })
              : t('aiReview.casesPendingReview', { count: cases.length })}
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'review' | 'chat')}>
          <TabsList className="border-b border-border/80">
            <TabsTab value="review" className="font-medium">{t('aiReview.reviewQueue')}</TabsTab>
            <TabsTab value="chat" className="font-medium">{t('aiReview.projectChat')}</TabsTab>
          </TabsList>
        </Tabs>
      </header>

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
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden divide-y divide-border">
            <ResizableSplit
              storageKey="ai-review-sidebar"
              defaultWidth={288}
              minWidth={240}
              maxRatio={0.5}
              first={
                <div className="flex flex-col md:min-h-0 md:h-full border-r border-border bg-surface">
                  <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-border bg-canvas/30">
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
                  <div className="md:flex-1 md:overflow-y-auto">
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
                <div className="flex min-w-0 flex-col md:min-h-0 md:flex-1 md:overflow-y-auto bg-surface">
                  <div className="flex-1">
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
            <CoverageGapsPanel projectId={projectId} onDraftWithAi={handleDraftWithAi} />
          </div>
        )
      ) : (
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden h-[70vh] min-h-[420px] max-h-[720px]">
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
