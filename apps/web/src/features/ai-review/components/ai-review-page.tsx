'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAiReview } from '@/features/ai-review/hooks/use-ai-review'
import { useAiProviders } from '@/features/ai-review/hooks/use-ai-providers'
import { ReviewCaseList } from './review-case-list'
import { ReviewCaseDetail } from './review-case-detail'
import { ReviewToolbar } from './review-toolbar'
import { CoverageGapsPanel } from './coverage-gaps-panel'
import { ProjectChatPanel } from './project-chat-panel'
import { Tabs, TabsList, TabsTab, TabsPanel } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'

export function AiReviewPage({ projectId }: { projectId: string }) {
  const {
    cases,
    selectedCase,
    selectCase,
    confirmSelected,
    rejectSelected,
    skipSelected,
    confirmAll,
  } = useAiReview(projectId)
  const { connectedProviders, hasConnected } = useAiProviders()
  const [tab, setTab] = useState<'review' | 'chat'>('review')
  const [listFilter, setListFilter] = useState<'all' | 'duplicates'>('all')
  const [prefillPrompt, setPrefillPrompt] = useState<string | undefined>(undefined)

  const handleDraftWithAi = (area: string) => {
    setPrefillPrompt(`Sugiéreme casos de prueba para: ${area}`)
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
          <h1 className="text-2xl font-semibold tracking-tight text-default">AI Review</h1>
          {hasConnected ? (
            <Badge variant="pass">
              <CheckCircle size={11} weight="fill" aria-hidden="true" />
              {connectedProviders[0].label} connected
            </Badge>
          ) : (
            <Link href="/settings">
              <Badge variant="warn">
                <WarningCircle size={11} weight="fill" aria-hidden="true" />
                No AI provider connected
              </Badge>
            </Link>
          )}
        </div>
        <p className="text-[11px] text-muted mb-4">
          {cases.length} case{cases.length !== 1 ? 's' : ''} pending review
        </p>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'review' | 'chat')}>
          <TabsList>
            <TabsTab value="review">Review Queue</TabsTab>
            <TabsTab value="chat">Project Chat</TabsTab>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'review' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex min-h-0">
            <div className="w-72 shrink-0 border-r border-border flex flex-col min-h-0">
              <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
                <button
                  onClick={() => setListFilter('all')}
                  className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                    listFilter === 'all' ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-canvas'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setListFilter('duplicates')}
                  className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                    listFilter === 'duplicates' ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-canvas'
                  }`}
                >
                  Possible duplicates
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ReviewCaseList
                  cases={cases}
                  selectedId={selectedCase?.id}
                  onSelect={selectCase}
                  filter={listFilter}
                />
              </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
              <div className="flex-1">
                {selectedCase ? (
                  <ReviewCaseDetail c={selectedCase} />
                ) : (
                  <div className="flex items-center justify-center h-full text-[11px] text-muted p-4">
                    Select a case to review
                  </div>
                )}
              </div>
              <ReviewToolbar
                disabled={!selectedCase}
                onConfirm={confirmSelected}
                onReject={rejectSelected}
                onSkip={skipSelected}
                onConfirmAll={confirmAll}
                pendingCount={cases.length}
              />
            </div>
          </div>
          <CoverageGapsPanel projectId={projectId} onDraftWithAi={handleDraftWithAi} />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ProjectChatPanel projectId={projectId} onViewCase={handleViewCase} prefillPrompt={prefillPrompt} />
        </div>
      )}
    </div>
  )
}
