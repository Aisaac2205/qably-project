'use client'

import { useId, useMemo, useState } from 'react'
import { ChatCircleText, GitCommit, Sparkle, type Icon } from '@phosphor-icons/react'
import type { ProposalOrigin } from '@qably/types'
import { useTranslation } from '@/lib/i18n'
import type { ProposalListItem } from '../api/review.api'
import { summarizeOrigins, type OriginGroup } from '../lib/summarize-origins'

const VISIBLE_GROUPS = 3

const ORIGIN_ICONS: Record<ProposalOrigin['kind'], Icon> = {
  push: GitCommit,
  documentation: Sparkle,
  'case-documentation': Sparkle,
  chat: ChatCircleText,
}

const GROUP_LABEL_KEYS: Record<Exclude<ProposalOrigin['kind'], 'push'>, string> = {
  documentation: 'reviewInbox.originGroupDocumentation',
  'case-documentation': 'reviewInbox.originGroupCaseDocumentation',
  chat: 'reviewInbox.originGroupChat',
}

function OriginGroupDescription({ origin }: { origin: ProposalOrigin }) {
  const { t } = useTranslation()

  if (origin.kind !== 'push') return <span>{t(GROUP_LABEL_KEYS[origin.kind])}</span>
  if (origin.commitSha === null) return <span>{t('reviewInbox.originGroupPushUnknown')}</span>

  return (
    <span className="min-w-0">
      {t('reviewInbox.originGroupPush')}{' '}
      <span className="font-mono text-xs">{origin.commitSha.slice(0, 7)}</span>
      {origin.commitTitle && <> &ldquo;{origin.commitTitle}&rdquo;</>}
      {origin.author && <> {t('reviewInbox.originGroupByAuthor', { author: origin.author })}</>}
      {origin.branch && <> {t('reviewInbox.originGroupOnBranch', { branch: origin.branch })}</>}
      {origin.pullRequestNumber !== null && (
        <> {t('reviewInbox.originGroupPullRequest', { number: origin.pullRequestNumber })}</>
      )}
    </span>
  )
}

function OriginGroupItem({ group }: { group: OriginGroup }) {
  const GroupIcon = ORIGIN_ICONS[group.origin.kind]

  return (
    <li className="flex min-w-0 items-baseline gap-1.5 text-sm text-default">
      <GroupIcon size={13} weight="bold" className="relative top-0.5 shrink-0 text-muted" aria-hidden="true" />
      <span className="font-semibold tabular-nums">{group.count}</span>
      <OriginGroupDescription origin={group.origin} />
    </li>
  )
}

interface InboxOriginSummaryProps {
  proposals: readonly ProposalListItem[]
  /** True while more inbox pages remain unloaded, so the counts are partial. */
  hasMore: boolean
}

/**
 * Explains why the loaded proposals are in the inbox, grouped by the push,
 * documentation request or chat that produced them. Built from the loaded
 * pages only, and says so while more remain.
 */
export function InboxOriginSummary({ proposals, hasMore }: InboxOriginSummaryProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const [expanded, setExpanded] = useState(false)
  const groups = useMemo(() => summarizeOrigins(proposals), [proposals])

  if (groups.length === 0) return null

  const hasPush = groups.some((group) => group.origin.kind === 'push')
  const hiddenCount = Math.max(groups.length - VISIBLE_GROUPS, 0)
  const visibleGroups = expanded ? groups : groups.slice(0, VISIBLE_GROUPS)
  const loadedCount = groups.reduce((total, group) => total + group.count, 0)

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-2 rounded-xl border border-border bg-surface p-3"
    >
      <h2 id={headingId} className="text-xs font-semibold text-default">
        {t('reviewInbox.originSummaryLabel')}
      </h2>
      {hasPush && (
        <p className="max-w-prose text-xs leading-relaxed text-muted">
          {t('reviewInbox.originSummaryExplanation')}
        </p>
      )}
      <ul className="space-y-1">
        {visibleGroups.map((group) => (
          <OriginGroupItem key={group.key} group={group} />
        ))}
      </ul>
      {(hiddenCount > 0 || hasMore) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {hiddenCount > 0 && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="rounded-sm text-xs font-semibold text-default transition-colors hover:underline outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {expanded
                ? t('reviewInbox.originSummaryShowLess')
                : t('reviewInbox.originSummaryShowMore', { count: hiddenCount })}
            </button>
          )}
          {hasMore && (
            <p className="text-xs text-muted">
              {t('reviewInbox.originSummaryLoaded', { count: loadedCount })}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
