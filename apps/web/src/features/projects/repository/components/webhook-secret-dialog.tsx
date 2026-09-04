'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'

interface WebhookSecretDialogProps {
  secret: string | undefined
  onDismiss: () => void
}

export function WebhookSecretDialog({ secret, onDismiss }: WebhookSecretDialogProps) {
  return (
    <Dialog
      open={secret !== undefined}
      onOpenChange={(open) => {
        if (!open) onDismiss()
      }}
    >
      {secret !== undefined && (
        <WebhookSecretDialogContent key={secret} secret={secret} onDismiss={onDismiss} />
      )}
    </Dialog>
  )
}

function WebhookSecretDialogContent({
  secret,
  onDismiss,
}: {
  secret: string
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timeout)
  }, [copied])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{t('repository.secretRevealTitle')}</DialogTitle>
        <DialogDescription>{t('repository.secretRevealWarning')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-default">{t('repository.secretLabel')}</span>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-default">
            {secret}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handleCopy}
            aria-label={t('repository.copySecret')}
            autoFocus
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          </Button>
        </div>
        <span className="sr-only" aria-live="polite" role="status">
          {copied ? t('repository.copied') : ''}
        </span>
      </div>

      <DialogFooter>
        <Button type="button" onClick={onDismiss}>
          {t('repository.done')}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
