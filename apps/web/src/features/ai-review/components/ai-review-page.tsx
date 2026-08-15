'use client'

import { useState } from 'react'
import { useAiReview } from '@/features/projects/test-generation/hooks/use-ai-review'
import { useAiProviders } from '@/features/projects/test-generation/hooks/use-ai-providers'
import { ReviewCaseList } from './review-case-list'
import { ReviewCaseDetail } from './review-case-detail'
import { ReviewToolbar } from './review-toolbar'
import { CoverageGapsPanel } from './coverage-gaps-panel'
import { ProjectChatPanel } from './project-chat-panel'
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { Badge } from '@/components/ui/badge'
import { StateView } from '@/components/ui/state-view'
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function AiReviewPage({ projectId }: { projectId: string }) {
  const {
    cases,
    selectedCase,
    selectCase,
    confirmSelected,
    rejectSelected,
    skipSelected,
  } = useAiReview(projectId)
  const { connectedProviders, hasConnected } = useAiProviders()
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
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-semibold tracking-tight text-default">{t('aiReview.title')}</h1>
          {hasConnected ? (
            <Badge variant="pass">
              <CheckCircle size={11} weight="fill" aria-hidden="true" />
              {connectedProviders[0].label}{t('aiReview.connected')}
            </Badge>
          ) : (
            <Badge variant="warn">
              <WarningCircle size={11} weight="fill" aria-hidden="true" />
              {t('aiReview.noProvider')}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted mb-4">
          {cases.length === 1 ? t('aiReview.casePendingReview', { count: cases.length }) : t('aiReview.casesPendingReview', { count: cases.length })}
        </p>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'review' | 'chat')}>
          <TabsList>
            <TabsTab value="review">{t('aiReview.reviewQueue')}</TabsTab>
            <TabsTab value="chat">{t('aiReview.projectChat')}</TabsTab>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'review' ? cases.length === 0 ? (
        <StateView
          kind="empty"
          title={t('aiReview.noCasesPending')}
          className="flex-1"
        />
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <ResizableSplit
            storageKey="ai-review-sidebar"
            defaultWidth={288}
            minWidth={240}
            maxRatio={0.5}
            first={
              <div className="flex flex-col md:min-h-0 md:h-full">
                <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border">
                  <button
                    type="button"
                    aria-pressed={listFilter === 'all'}
                    onClick={() => setListFilter('all')}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                      listFilter === 'all' ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-canvas'
                    }`}
                  >
                    {t('aiReview.filterAll')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={listFilter === 'duplicates'}
                    onClick={() => setListFilter('duplicates')}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                      listFilter === 'duplicates' ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-canvas'
                    }`}
                  >
                    {t('aiReview.filterDuplicates')}
                  </button>
                </div>
                <div className="md:flex-1 md:overflow-y-auto">
                  <ReviewCaseList
                    cases={cases}
                    selectedId={selectedCase?.id}
                    onSelect={selectCase}
                    filter={listFilter}
                  />
                </div>
              </div>
            }
            second={
              <div className="flex min-w-0 flex-col md:min-h-0 md:flex-1 md:overflow-y-auto">
                <div className="flex-1">
                  {selectedCase ? (
                    <ReviewCaseDetail c={selectedCase} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted p-6 text-center">
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
      ) : (
        <div className="flex-1 min-h-0">
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
