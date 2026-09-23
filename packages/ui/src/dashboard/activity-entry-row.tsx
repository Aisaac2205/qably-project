import type { ReactNode } from 'react'
import { StatusChip, type ChipStatus } from './status-chip'

export type ActivityEntryStatus = Extract<ChipStatus, 'pass' | 'fail' | 'running' | 'pending'>

interface ActivityEntryRowBase {
  projectName: string
  status: ActivityEntryStatus
  statusLabel: string
  relativeTime: string
  occurredAt: string
  casesSummary: string
  sourceIcon: ReactNode
  sourceLabel: string
  commitIcon?: ReactNode
}

export interface CommitActivityEntryRowProps extends ActivityEntryRowBase {
  kind: 'commit'
  commitSha: string
  commitMessage?: string
}

export interface RunActivityEntryRowProps extends ActivityEntryRowBase {
  kind: 'run'
  runName: string
}

export type ActivityEntryRowProps = CommitActivityEntryRowProps | RunActivityEntryRowProps

export function ActivityEntryRow(props: ActivityEntryRowProps) {
  const { projectName, status, statusLabel, relativeTime, occurredAt, casesSummary, sourceIcon, sourceLabel } = props
  const title = props.kind === 'run' ? `${projectName} · ${props.runName}` : projectName

  return (
    <div className="flex min-w-0 items-start gap-3 py-3">
      <div
        role="img"
        aria-label={sourceLabel}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-qb-canvas text-qb-muted"
      >
        {sourceIcon}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <p title={title} className="min-w-0 truncate text-xs font-medium text-qb-fg">
            {title}
          </p>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <StatusChip status={status} label={statusLabel} />
            <time dateTime={occurredAt} className="text-xs text-qb-muted tabular-nums">
              {relativeTime}
            </time>
          </div>
        </div>

        {props.kind === 'commit' ? (
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-qb-muted">
            {props.commitIcon}
            <span title={props.commitSha} className="shrink-0 font-mono text-qb-fg">
              {props.commitSha.slice(0, 7)}
            </span>
            {props.commitMessage !== undefined ? (
              <span title={props.commitMessage} className="min-w-0 truncate">
                {props.commitMessage}
              </span>
            ) : null}
          </div>
        ) : null}

        <span className="text-xs text-qb-muted tabular-nums">{casesSummary}</span>
      </div>
    </div>
  )
}
