'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from '@phosphor-icons/react'
import type { ApiKeyWithSecret } from '@qably/types'
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

interface RevealTokenDialogProps {
  apiKey: ApiKeyWithSecret | undefined
  onDismiss: () => void
}

export function RevealTokenDialog({ apiKey, onDismiss }: RevealTokenDialogProps) {
  return (
    <Dialog open={apiKey !== undefined} onOpenChange={(open) => { if (!open) onDismiss() }}>
      {apiKey && (
        <RevealTokenDialogContent key={apiKey.id} apiKey={apiKey} onDismiss={onDismiss} />
      )}
    </Dialog>
  )
}

function RevealTokenDialogContent({
  apiKey,
  onDismiss,
}: {
  apiKey: ApiKeyWithSecret
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
      await navigator.clipboard.writeText(apiKey.token)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{t('apiKeys.revealTitle')}</DialogTitle>
        <DialogDescription>{t('apiKeys.revealWarning')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-default">{t('apiKeys.tokenLabel')}</span>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-default">
            {apiKey.token}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handleCopy}
            aria-label={t('apiKeys.copy')}
            autoFocus
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          </Button>
        </div>
        <span className="sr-only" aria-live="polite" role="status">
          {copied ? t('apiKeys.copied') : ''}
        </span>
      </div>

      <DialogFooter>
        <Button type="button" onClick={onDismiss}>
          {t('apiKeys.done')}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
