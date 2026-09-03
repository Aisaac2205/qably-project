'use client'

import Link from 'next/link'
import { Folders, ArrowRight, Sparkle } from '@phosphor-icons/react'
import { useProposals } from '@/lib/use-mock-store'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { useTranslation } from '@/lib/i18n'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function ProjectReviewDistribution({
  onSelectProject,
}: {
  onSelectProject?: (projectId: string) => void
}) {
  const { projects } = useProjects()
  const proposals = useProposals()
  const { t } = useTranslation()

  // Compute breakdown
  const projectStats = projects.map((project) => {
    const projectProposals = proposals.filter((p) => p.projectId === project.id)
    const pending = projectProposals.filter((p) => p.status === 'in_review').length
    const approved = projectProposals.filter((p) => p.status === 'approved').length
    const duplicates = projectProposals.filter((p) => Boolean(p.targetOfficialTestCaseId)).length

    return {
      project,
      total: projectProposals.length,
      pending,
      approved,
      duplicates,
    }
  })

  return (
    <Card className="rounded-xl border border-border/80 bg-surface shadow-card flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between p-5 pb-3">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-semibold text-default flex items-center gap-2">
            <Folders size={16} aria-hidden="true" className="text-muted" />
            {t('reviewInbox.projectDistributionTitle')}
          </CardTitle>
          <p className="text-xs text-muted">
            {t('reviewInbox.projectDistributionSubtitle')}
          </p>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-x-auto">
        <table className="w-full border-collapse text-left min-w-[360px]">
          <caption className="sr-only">{t('reviewInbox.projectDistributionTitle')}</caption>
          <thead>
            <tr className="border-b border-border bg-canvas/40">
              <th className="text-xs font-medium text-muted px-5 py-2.5">{t('reviewInbox.project')}</th>
              <th className="text-xs font-medium text-muted px-3 py-2.5 text-center">{t('status.review.pending')}</th>
              <th className="text-xs font-medium text-muted px-3 py-2.5 text-center">{t('status.review.confirmed')}</th>
              <th className="text-xs font-medium text-muted px-5 py-2.5 text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {projectStats.map(({ project, pending, approved }) => (
              <tr key={project.id} className="hover:bg-canvas/20 transition-colors group">
                <td className="px-5 py-3">
                  {onSelectProject ? (
                    <button
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                      className="text-xs font-semibold text-default hover:text-primary transition-colors text-left"
                    >
                      {project.name}
                    </button>
                  ) : (
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-xs font-semibold text-default hover:text-primary transition-colors"
                    >
                      {project.name}
                    </Link>
                  )}
                  {project.githubRepo && (
                    <p className="font-mono text-[10px] text-muted truncate max-w-44">
                      {project.githubRepo}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {pending > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-ai-bg text-ai">
                      <Sparkle size={11} weight="fill" aria-hidden="true" />
                      <span className="tabular-nums font-mono">{pending}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted/60 font-mono">0</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center text-xs font-mono tabular-nums text-default">
                  {approved}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/projects/${project.id}/ai-review`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline transition-all"
                  >
                    <span>{t('reviewInbox.openProject')}</span>
                    <ArrowRight size={11} weight="bold" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
