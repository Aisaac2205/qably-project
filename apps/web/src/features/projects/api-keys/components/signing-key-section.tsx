'use client'

import { useState } from 'react'
import { ArrowsClockwise, WarningCircle } from '@phosphor-icons/react'
import { SecretCard } from '@/components/security/secret-card'
import { SecretRevealDialog } from '@/components/security/secret-reveal-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useTranslation } from '@/lib/i18n'
import { useProjectRepository } from '@/features/projects/repository/hooks/use-project-repository'
import { useRotateSigningKey } from '../hooks/use-rotate-signing-key'

export function SigningKeySection({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const [rotateOpen, setRotateOpen] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | undefined>(undefined)
  const rotateMutation = useRotateSigningKey(projectId)
  const { repository, isLoading } = useProjectRepository(projectId)

  if (isLoading || repository?.source == null) return null

  return (
    <>
      <SecretCard
        icon={
          <span
            aria-hidden="true"
            className="block size-7 bg-accent-icon"
            style={{
              mask: 'url(/webhooks.svg) center / contain no-repeat',
              WebkitMask: 'url(/webhooks.svg) center / contain no-repeat',
            }}
          />
        }
        headingId="signing-key-heading"
        title={t('apiKeys.signingKey.heading')}
        description={t('apiKeys.signingKey.description')}
        error={rotateMutation.isError ? t('apiKeys.signingKey.rotateError') : undefined}
        action={{
          label: rotateMutation.isPending ? t('apiKeys.signingKey.rotating') : t('apiKeys.signingKey.rotate'),
          icon: <ArrowsClockwise size={14} weight="bold" aria-hidden="true" />,
          onClick: () => setRotateOpen(true),
          disabled: rotateMutation.isPending,
        }}
      />

      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        icon={<WarningCircle size={20} weight="fill" aria-hidden="true" />}
        title={t('apiKeys.signingKey.rotateConfirmTitle')}
        description={t('apiKeys.signingKey.rotateConfirmDescription')}
        confirmLabel={t('apiKeys.signingKey.rotateConfirmAction')}
        onConfirm={() => {
          rotateMutation.mutate(undefined, {
            onSuccess: (rotated) => {
              setRotateOpen(false)
              setRevealedKey(rotated.webhookSecret)
            },
          })
        }}
      />

      <SecretRevealDialog
        value={revealedKey}
        onDismiss={() => setRevealedKey(undefined)}
        title={t('apiKeys.signingKey.revealTitle')}
        description={t('apiKeys.signingKey.revealWarning')}
        valueLabel={t('apiKeys.signingKey.valueLabel')}
        copyAriaLabel={t('apiKeys.signingKey.copy')}
        copiedAnnouncement={t('apiKeys.signingKey.copied')}
        doneLabel={t('apiKeys.done')}
      />
    </>
  )
}
