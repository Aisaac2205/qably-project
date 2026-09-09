'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MagnifyingGlass } from '@phosphor-icons/react'
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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlTab = searchParams.get('tab') === 'chat' ? 'chat' : 'review'
  const [tab, setTab] = useState<'review' | 'chat'>(urlTab)
  const [syncedUrlTab, setSyncedUrlTab] = useState<'review' | 'chat'>(urlTab)
  const [listFilter, setListFilter] = useState<'all' | 'duplicates'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  if (urlTab !== syncedUrlTab) {
    setSyncedUrlTab(urlTab)
    setTab(urlTab)
  }

  const openTab = useCallback(
    (next: 'review' | 'chat') => {
      setTab(next)
      router.replace(next === 'chat' ? `${pathname}?tab=chat` : pathname, {
        scroll: false,
      })
    },
    [router, pathname],
  )

  const isChat = tab === 'chat'

  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases
    const q = searchQuery.toLowerCase().trim()
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.objective.toLowerCase().includes(q) ||
        (c.evidenceTitle && c.evidenceTitle.toLowerCase().includes(q)),
    )
  }, [cases, searchQuery])

  return (
    <div className="w-full flex-1 flex flex-col h-full min-h-0 text-default animate-page-enter bg-surface">
      {!isChat && (
        <header className="shrink-0 px-5 pt-4 pb-4 sm:px-6 sm:pt-5 border-b border-border/80 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-surface">
          <div className="space-y-1">
            <Breadcrumbs
              items={[
                { label: t('suites.breadcrumbProjects'), href: '/projects' },
                ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
                { label: t('aiReview.title') },
              ]}
            />
            <div className="pt-0.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-default">
                {t('aiReview.title')}
              </h1>
              <p className="text-xs sm:text-sm text-muted mt-0.5">
                {cases.length === 1
                  ? t('aiReview.casePendingReview', { count: cases.length })
                  : t('aiReview.casesPendingReview', { count: cases.length })}
              </p>
            </div>
          </div>

          <SegmentedControl
            className="shrink-0 self-start sm:self-auto"
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
            onChange={openTab}
          />
        </header>
      )}

      <div
        id="ai-review-panel-review"
        role={isChat ? undefined : 'tabpanel'}
        aria-labelledby={isChat ? undefined : 'ai-review-tab-review'}
        hidden={isChat}
        className="flex-1 min-h-0 flex flex-col h-full"
      >
        {isLoading ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center bg-surface">
            <StateView kind="loading" title={t('aiReview.loading')} className="p-12" />
          </div>
        ) : isError ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center bg-surface">
            <StateView kind="error" title={t('aiReview.loadError')} className="p-12" />
          </div>
        ) : cases.length === 0 ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center bg-surface">
            <StateView
              kind="empty"
              title={t('aiReview.noCasesPending')}
              className="p-12"
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 h-full flex flex-col">
            <ResizableSplit
              storageKey="ai-review-sidebar"
              defaultWidth={340}
              minWidth={280}
              maxRatio={0.5}
              className="h-full flex-1 min-h-0"
              first={
                <div className="flex flex-col h-full min-h-0 bg-surface">
                  <div className="flex flex-col gap-2.5 p-3.5 sm:p-4 border-b border-border/80 bg-canvas/30 shrink-0">
                    <div className="relative">
                      <MagnifyingGlass
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('reviewInbox.searchPlaceholder') || 'Buscar por título, archivo u objetivo...'}
                        aria-label={t('reviewInbox.searchPlaceholder') || 'Buscar casos'}
                        className="w-full rounded-full border border-border/80 bg-surface pl-8.5 pr-3.5 py-1.5 text-xs text-default placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      />
                    </div>
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
                      proposals={filteredCases}
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
        )}
      </div>

      <div
        id="ai-review-panel-chat"
        role={isChat ? undefined : 'tabpanel'}
        aria-labelledby={isChat ? undefined : 'ai-review-tab-chat'}
        hidden={!isChat}
        className="flex-1 min-h-0"
      >
        <div className="flex flex-col h-full min-h-0 bg-surface overflow-hidden">
          <ProjectChatPanel projectId={projectId} onExit={() => openTab('review')} />
        </div>
      </div>
    </div>
  )
}

