'use client'

import { Fragment, useId, useMemo, useState, type ReactNode } from 'react'
import type {
  AttributedCommit,
  RunAttribution,
  RunAttributionUnknownReason,
} from '@qably/types'
import { ArrowSquareOut, CaretRight, GitBranch } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { formatRelative } from '@/features/projects/suites/lib/format-relative'

const SHORT_SHA_LENGTH = 7
const COLLAPSED_COMMIT_COUNT = 5

const FOCUS_RING =
  'focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/**
 * One copy key per reason. Typed as a full record so that adding a reason to
 * `RunAttributionUnknownReason` is a type error until it has its copy.
 */
export const UNKNOWN_REASON_COPY_KEYS: Record<RunAttributionUnknownReason, string> = {
  no_commit_reported: 'runs.attribution.unknown.noCommitReported',
  no_repository_connected: 'runs.attribution.unknown.noRepositoryConnected',
  commit_not_in_history: 'runs.attribution.unknown.commitNotInHistory',
  different_branch: 'runs.attribution.unknown.differentBranch',
  history_gap: 'runs.attribution.unknown.historyGap',
  history_rewritten: 'runs.attribution.unknown.historyRewritten',
  out_of_order: 'runs.attribution.unknown.outOfOrder',
  range_too_large: 'runs.attribution.unknown.rangeTooLarge',
}

function shortSha(sha: string): string {
  return sha.slice(0, SHORT_SHA_LENGTH)
}

function firstLine(message: string): string {
  return (
    message
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '') ?? ''
  )
}

/** Commit urls come from a webhook payload: only http(s) may become a link. */
function toHttpUrl(url: string | null): string | null {
  if (url === null) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null
  } catch {
    return null
  }
}

function formatAbsolute(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    )
  } catch {
    return iso
  }
}

function CommitSha({ commit }: { commit: AttributedCommit }) {
  const { t } = useTranslation()
  const href = toHttpUrl(commit.url)
  const label = shortSha(commit.sha)

  if (href === null) {
    return (
      <span className="inline-flex min-h-6 shrink-0 items-center font-mono text-xs text-default">
        {label}
      </span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('runs.attribution.commitLinkAria', { sha: commit.sha })}
      className={`inline-flex min-h-6 shrink-0 items-center gap-1 rounded font-mono text-xs text-primary underline underline-offset-2 hover:text-primary-hover ${FOCUS_RING}`}
    >
      {label}
      <ArrowSquareOut size={12} weight="bold" aria-hidden="true" />
    </a>
  )
}

function CommitItem({ commit }: { commit: AttributedCommit }) {
  const { t, locale } = useTranslation()
  const message = firstLine(commit.message)
  const author = commit.author.trim()
  const branch = commit.branch.trim()
  const relativeDate =
    commit.committedAt === null ? '' : formatRelative(commit.committedAt, locale, '')

  const meta: Array<{ id: string; node: ReactNode }> = []
  if (author !== '') {
    meta.push({
      id: 'author',
      node: <span className="wrap-anywhere">{t('runs.attribution.commitAuthor', { author })}</span>,
    })
  }
  if (branch !== '') {
    meta.push({
      id: 'branch',
      node: (
        <span className="inline-flex items-center gap-1 wrap-anywhere">
          <GitBranch size={12} weight="bold" aria-hidden="true" className="shrink-0" />
          {t('runs.attribution.commitBranch', { branch })}
        </span>
      ),
    })
  }
  if (commit.committedAt !== null && relativeDate !== '') {
    meta.push({
      id: 'date',
      node: (
        <time dateTime={commit.committedAt} title={formatAbsolute(commit.committedAt, locale)}>
          {relativeDate}
        </time>
      ),
    })
  }

  return (
    <li className="min-w-0 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <CommitSha commit={commit} />
        {message === '' ? (
          <span className="min-w-0 flex-1 truncate text-sm text-muted">
            {t('runs.attribution.noMessage')}
          </span>
        ) : (
          <span
            className="min-w-0 flex-1 truncate text-sm text-default"
            title={commit.message.trim()}
          >
            {message}
          </span>
        )}
      </div>
      {meta.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          {meta.map(({ id, node }, index) => (
            <Fragment key={id}>
              {index > 0 && <span aria-hidden="true">·</span>}
              {node}
            </Fragment>
          ))}
        </p>
      )}
    </li>
  )
}

function CommitList({ commits, label }: { commits: AttributedCommit[]; label: string }) {
  const { t } = useTranslation()
  const listId = useId()
  const [expanded, setExpanded] = useState(false)
  const newestFirst = useMemo(() => [...commits].reverse(), [commits])
  const hiddenCount = Math.max(newestFirst.length - COLLAPSED_COMMIT_COUNT, 0)
  const visible = expanded ? newestFirst : newestFirst.slice(0, COLLAPSED_COMMIT_COUNT)

  return (
    <div className="space-y-1">
      <ul id={listId} role="list" aria-label={label} className="divide-y divide-border">
        {visible.map((commit) => (
          <CommitItem key={commit.sha} commit={commit} />
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((open) => !open)}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded text-xs font-medium text-muted transition-transform duration-150 ease-out-quart hover:text-default active:scale-97 motion-reduce:transition-none md:min-h-8 ${FOCUS_RING}`}
        >
          <CaretRight
            size={12}
            weight="bold"
            aria-hidden="true"
            className={`shrink-0 transition-transform duration-150 ease-out-quart motion-reduce:transition-none ${expanded ? 'rotate-90' : ''}`}
          />
          {expanded
            ? t('runs.attribution.showLess')
            : t('runs.attribution.showMore', { count: hiddenCount })}
        </button>
      )}
    </div>
  )
}

function AttributionBody({ attribution, title }: { attribution: RunAttribution; title: string }) {
  const { t } = useTranslation()

  switch (attribution.kind) {
    case 'range':
      return (
        <div className="space-y-1">
          <p className="text-xs text-muted">
            {t('runs.attribution.rangeSummary', { count: attribution.commits.length })}
          </p>
          {attribution.commits.length > 0 && (
            <CommitList commits={attribution.commits} label={title} />
          )}
        </div>
      )
    case 'same_commit':
      return (
        <p className="text-sm text-default">
          {t('runs.attribution.sameCommit')}{' '}
          <span className="font-mono text-xs">{shortSha(attribution.sha)}</span>
        </p>
      )
    case 'unknown':
      return (
        <p className="text-sm text-muted">{t(UNKNOWN_REASON_COPY_KEYS[attribution.reason])}</p>
      )
    default: {
      const unreachable: never = attribution
      return unreachable
    }
  }
}

/**
 * The commits pushed between the previous run and this one, as candidates. It
 * is a list of what landed in between, never a statement about which commit
 * changed a result. The API sends them oldest first; the list shows them
 * newest first, like `git log`, so the commits closest to this run lead and the
 * disclosure hides the oldest.
 */
export function CommitRangeBlock({ attribution }: { attribution: RunAttribution }) {
  const { t } = useTranslation()
  const title = t('runs.attribution.title')

  return (
    <div className="space-y-1.5 border-t border-border pt-3">
      <h3 className="text-sm font-semibold text-default">{title}</h3>
      <AttributionBody attribution={attribution} title={title} />
      <p className="text-xs text-muted">{t('runs.attribution.hint')}</p>
    </div>
  )
}
