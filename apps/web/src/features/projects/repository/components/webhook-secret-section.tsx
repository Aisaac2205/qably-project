'use client'

import { useState } from 'react'
import { ArrowsClockwise, LockKey, WarningCircle } from '@phosphor-icons/react'
import { SecretCard } from '@/components/security/secret-card'
import { SecretRevealDialog } from '@/components/security/secret-reveal-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useTranslation } from '@/lib/i18n'
import { useRotateWebhookSecret } from '../hooks/use-rotate-webhook-secret'

export function WebhookSecretSection({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const [rotateOpen, setRotateOpen] = useState(false)
  const [revealedSecret, setRevealedSecret] = useState<string | undefined>(undefined)
  const rotateMutation = useRotateWebhookSecret(projectId)

  return (
    <>
      <SecretCard
        icon={<LockKey size={20} aria-hidden="true" />}
        headingId="webhook-secret-heading"
        title={t('repository.webhookSecretHeading')}
        description={t('repository.webhookSecretDescription')}
        error={rotateMutation.isError ? t('repository.rotateError') : undefined}
        action={{
          label: rotateMutation.isPending ? t('repository.rotating') : t('repository.rotateSecret'),
          icon: <ArrowsClockwise size={14} weight="bold" aria-hidden="true" />,
          onClick: () => setRotateOpen(true),
          disabled: rotateMutation.isPending,
        }}
      />

      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        icon={<WarningCircle size={20} weight="fill" aria-hidden="true" />}
        title={t('repository.rotateConfirmTitle')}
        description={t('repository.rotateConfirmDescription')}
        confirmLabel={t('repository.rotateConfirmAction')}
        onConfirm={() => {
          rotateMutation.mutate(undefined, {
            onSuccess: (rotated) => {
              setRotateOpen(false)
              setRevealedSecret(rotated.webhookSecret)
            },
          })
        }}
      />

      <SecretRevealDialog
        value={revealedSecret}
        onDismiss={() => setRevealedSecret(undefined)}
        title={t('repository.secretRevealTitle')}
        description={t('repository.secretRevealWarning')}
        valueLabel={t('repository.secretLabel')}
        copyAriaLabel={t('repository.copySecret')}
        copiedAnnouncement={t('repository.copied')}
        doneLabel={t('repository.done')}
      />
    </>
  )
}
