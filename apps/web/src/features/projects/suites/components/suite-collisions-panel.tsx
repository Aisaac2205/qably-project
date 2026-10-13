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
  /** The open keys; only the single-suite view carries them. */
  collisions?: SuiteCollision[]
}

const KIND_EXPLANATION_KEY = {
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
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Warning size={14} weight="bold" className="shrink-0 text-warn" aria-hidden="true" />
          <h3
            ref={titleRef}
            tabIndex={-1}
            className="rounded-sm text-xs font-semibold text-warn outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('suites.openCollisionsTitle')}
          </h3>
        </div>
        <p role="status" className="text-sm text-default leading-relaxed">
          {t('suites.openCollisions', { count: openCollisions })}
        </p>
      </div>

      {collisions !== undefined && collisions.length > 0 ? (
        <ul className="divide-y divide-warn/20 border-y border-warn/20">
          {collisions.map((collision) => (
            <li key={collision.id} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1 space-y-0.5">
                <code className="block font-mono text-xs text-default break-all">
                  {collision.key}
                </code>
                <p className="text-xs text-muted leading-relaxed">
                  {t(KIND_EXPLANATION_KEY[collision.kind])}
                </p>
                <p className="text-xs text-muted tabular-nums">
                  {t('suites.collisionClaimants', { count: collision.claimantCount })}
                  {' · '}
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
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                aria-label={t('suites.dismissCollisionLabel', { key: collision.key })}
                aria-describedby={hintId}
                disabled={pendingId === collision.id}
                onClick={() => handleDismiss(collision.id)}
                className="shrink-0"
              >
                {t('suites.dismissCollision')}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-0.5">
        <p className="text-xs text-muted leading-relaxed">{t('suites.openCollisionsHint')}</p>
        {collisions !== undefined && collisions.length > 0 ? (
          <p id={hintId} className="text-xs text-muted leading-relaxed">
            {t('suites.dismissCollisionHint')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
