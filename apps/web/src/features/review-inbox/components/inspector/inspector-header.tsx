'use client'

import Link from 'next/link'
import type { ExtractedProposal } from '@qably/types'
import {
  CheckCircle,
  XCircle,
  DotsThree,
  FileText,
  Clock,
  ChatsCircle,
  ChatCircleText,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n'
import { projectRootPath } from '@/features/projects/lib/routes'

interface InspectorHeaderProject {
  id: string
  name: string
}

interface InspectorHeaderProps {
  proposal: ExtractedProposal
  project: InspectorHeaderProject | undefined
  evidenceTitle: string | undefined
  formattedDate: string
}

function getPriorityBadgeVariant(priority: ExtractedProposal['priority']): 'warn' | 'default' {
  switch (priority) {
    case 'critical':
    case 'high':
      return 'warn'
    case 'medium':
    case 'low':
    default:
      return 'default'
  }
}

export function InspectorHeader({
  proposal,
  project,
  evidenceTitle,
  formattedDate,
}: InspectorHeaderProps) {
  const { t } = useTranslation()
  const isApproved = proposal.status === 'approved'
  const isRejected = proposal.status === 'rejected'

  return (
    <div className="space-y-3 pb-5 border-b border-border/80">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={getPriorityBadgeVariant(proposal.priority)}
            className="text-xs font-semibold capitalize px-2.5 py-0.5 rounded-full"
          >
            {proposal.priority}
          </Badge>
          {project && (
            <Link
              href={projectRootPath(project.id)}
              className="inline-flex items-center rounded-full border border-border/80 bg-canvas/60 px-2.5 py-0.5 text-xs font-medium text-default transition-colors hover:border-border-strong hover:text-primary"
            >
              {project.name}
            </Link>
          )}
          {isApproved && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-pass-bg text-pass">
              <CheckCircle size={13} weight="fill" aria-hidden="true" />
              {t('reviewInbox.decisionApproved')}
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-fail-bg text-fail">
              <XCircle size={13} weight="fill" aria-hidden="true" />
              {t('reviewInbox.decisionRejected')}
            </span>
          )}
        </div>

        <button
          type="button"
          aria-label={t('reviewInbox.proposalOptions')}
          className="rounded-lg p-1 text-muted hover:text-default hover:bg-canvas transition-colors"
        >
          <DotsThree size={20} weight="bold" aria-hidden="true" />
        </button>
      </div>

      <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-default leading-snug">
        {proposal.title}
      </h3>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <ChatsCircle size={14} className="shrink-0 text-muted" aria-hidden="true" />
          <span>Chat</span>
        </span>

        {evidenceTitle && (
          <span className="inline-flex items-center gap-1.5 font-mono">
            <FileText size={14} className="shrink-0 text-muted" aria-hidden="true" />
            <span className="text-default font-medium truncate max-w-xs">{evidenceTitle}</span>
          </span>
        )}

        <span className="inline-flex items-center gap-1.5">
          <Clock size={14} className="shrink-0 text-muted" aria-hidden="true" />
          <span>{formattedDate}</span>
        </span>

        <span className="inline-flex items-center gap-1.5">
          <ChatCircleText size={14} className="shrink-0 text-muted" aria-hidden="true" />
          <span>0</span>
        </span>
      </div>
    </div>
  )
}
