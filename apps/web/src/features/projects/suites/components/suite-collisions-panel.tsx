'use client'

import { useId, useRef } from 'react'
import Link from 'next/link'
import { Warning } from '@phosphor-icons/react'
import type { SuiteCollision } from '@qably/types'
import { Button } from '@/components/ui/button'
import { projectRunPath } from '@/features/projects/lib/routes'
import { formatRelative } from '@/features/projects/suites/lib/format-relative'
import { useTranslation } from '@/lib/i18n'
import { useDismissCollision } from '../hooks/use-suite-mutations'

interface SuiteCollisionsPanelProps {
  projectId: string
  suiteId: string
  openCollisions: number | undefined
  /** The open collisions; only the single-suite view carries them. */
  collisions?: SuiteCollision[]
}

const KIND_LEAD_IN_KEY = {
  identity: 'suites.collisionKindIdentity',
  legacy_key: 'suites.collisionKindLegacyKey',
} as const

export function SuiteCollisionsPanel({
  projectId,
  suiteId,
  openCollisions,
  collisions,
}: SuiteCollisionsPanelProps) {
  const { t, locale } = useTranslation()
  const hintId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const dismiss = useDismissCollision()

  if (openCollisions === undefined || openCollisions === 0) return null

  const pendingId = dismiss.isPending ? dismiss.variables?.collisionId : undefined
  const hasList = collisions !== undefined && collisions.length > 0
  const unlinkedTests = hasList
    ? collisions.reduce((total, collision) => total + collision.claimantCount, 0)
    : 0

  const handleDismiss = (collisionId: string) => {
    dismiss.mutate(
      { suiteId, projectId, collisionId },
      // The dismissed row and its button leave the DOM: keep focus inside the
      // panel instead of letting it fall back to the page.
      { onSuccess: () => titleRef.current?.focus() },
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-warn/40 bg-warn-bg/60 p-4">
      <div role="status" className="space-y-1">
        <div className="flex items-start gap-2">
          <Warning size={16} weight="bold" className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
          <h3
            ref={titleRef}
            tabIndex={-1}
            className="rounded-sm text-sm font-semibold text-default outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {hasList
              ? t('suites.openCollisionsTitle', { count: unlinkedTests })
              : t('suites.openCollisionsTitleUnknown')}
          </h3>
        </div>
        <p className="text-sm text-default leading-relaxed text-wrap-pretty">
          {t('suites.openCollisionsEffect')}
        </p>
      </div>

      {hasList ? (
        <ul className="divide-y divide-warn/20 border-y border-warn/20">
          {collisions.map((collision) => {
            const listed = collision.claimants.length > 0 ? collision.claimants : [collision.key]
            const unlisted =
              collision.claimants.length > 0 ? collision.claimantCount - collision.claimants.length : 0

            return (
              <li key={collision.id} className="space-y-2 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <p className="text-sm text-default leading-relaxed text-wrap-pretty">
                    {t(KIND_LEAD_IN_KEY[collision.kind])}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label={t('suites.dismissCollisionLabel', { key: collision.key })}
                    aria-describedby={hintId}
                    disabled={pendingId === collision.id}
                    onClick={() => handleDismiss(collision.id)}
                    className="shrink-0 self-start"
                  >
                    {t('suites.dismissCollision')}
                  </Button>
                </div>
                <ul aria-label={t('suites.collisionClaimantsLabel')} className="space-y-1">
                  {listed.map((name, index) => (
                    <li key={`${index}-${name}`}>
                      <code className="inline-block max-w-full rounded-sm bg-surface px-1.5 py-0.5 font-mono text-xs text-default break-words">
                        {name}
                      </code>
                    </li>
                  ))}
                </ul>
                {unlisted > 0 ? (
                  <p className="text-xs text-muted">
                    {t('suites.collisionClaimantsMore', { count: unlisted })}
                  </p>
                ) : null}
                <p className="text-xs text-muted tabular-nums">
                  {t('suites.collisionLastSeen', {
                    when: formatRelative(collision.lastSeenAt, locale, t('suites.never')),
                  })}
                  {collision.lastRunId === null ? null : (
                    <>
                      {' · '}
                      <Link
                        href={projectRunPath(projectId, collision.lastRunId)}
                        className="rounded-sm font-medium text-default underline underline-offset-2 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {t('suites.collisionLastRun')}
                      </Link>
                    </>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="space-y-0.5">
        <p className="text-xs text-muted leading-relaxed">{t('suites.openCollisionsHint')}</p>
        {hasList ? (
          <p id={hintId} className="text-xs text-muted leading-relaxed">
            {t('suites.dismissCollisionHint')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
