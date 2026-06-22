'use client'

import Link from 'next/link'
import { GitBranch } from '@phosphor-icons/react'
import type { PipelineRun } from '@qably/types'
import { StatusChip } from '@/components/ui/status-chip'

function shortSha(sha: string): string {
  return sha.slice(0, 7)
}

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  } catch {
    return iso
  }
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—'
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime()
    if (ms < 0) return '—'
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    if (m === 0) return `${s}s`
    return `${m}m ${s % 60}s`
  } catch {
    return '—'
  }
}

function getBranchInitials(branch: string): string {
  const parts = branch.split(/[-/]/).filter(Boolean)
  const initials = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
  return initials.slice(0, 2) || 'CI'
}

const AVATAR_COLORS = [
  'bg-primary/20 text-primary',
  'bg-running-bg text-running',
  'bg-pass-bg text-pass',
  'bg-ai-bg text-ai',
  'bg-warn-bg text-warn',
]

function getAvatarColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0x7fffffff
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function PipelineRow({ p, projectId }: { p: PipelineRun; projectId: string }) {
  const initials = getBranchInitials(p.branch)
  const avatarColor = getAvatarColor(p.branch)

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {/* Status */}
      <div className="w-24 shrink-0">
        <StatusChip status={p.status} />
      </div>

      {/* Workflow / Branch */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border bg-canvas text-muted">
            <GitBranch size={10} weight="bold" aria-hidden="true" />
            {p.branch}
          </span>
          <span
            className="text-[10px] font-mono text-muted tabular-nums"
            aria-label={`Commit ${p.commitSha}`}
          >
            {shortSha(p.commitSha)}
          </span>
          {p.runId ? (
            <Link
              href={`/projects/${projectId}/runs/${p.runId}`}
              className="text-[10px] font-mono text-primary hover:text-primary-hover transition-colors tabular-nums"
            >
              {p.runId}
            </Link>
          ) : (
            <span className="text-[10px] text-muted">—</span>
          )}
        </div>
        <p className="text-xs text-default truncate mt-0.5">{p.commitMessage}</p>
      </div>

      {/* Triggered by */}
      <div className="w-32 shrink-0 hidden lg:flex items-center gap-1.5">
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${avatarColor}`}
          aria-hidden="true"
        >
          {initials}
        </div>
        <span className="text-[11px] text-muted truncate">CI Bot</span>
      </div>

      {/* Started */}
      <div className="w-36 shrink-0">
        <span className="text-[11px] text-muted tabular-nums">{formatRelative(p.triggeredAt)}</span>
      </div>

      {/* Duration */}
      <div className="w-20 shrink-0 text-right">
        <span className="text-[11px] text-muted font-mono tabular-nums">
          {formatDuration(p.triggeredAt, p.finishedAt)}
        </span>
      </div>
    </div>
  )
}
