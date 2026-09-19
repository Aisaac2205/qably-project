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

interface SecretRevealDialogProps {
  value: string | undefined
  onDismiss: () => void
  title: string
  description: string
  valueLabel: string
  copyAriaLabel: string
  copiedAnnouncement: string
  doneLabel: string
}

export function SecretRevealDialog({
  value,
  onDismiss,
  title,
  description,
  valueLabel,
  copyAriaLabel,
  copiedAnnouncement,
  doneLabel,
}: SecretRevealDialogProps) {
  return (
    <Dialog open={value !== undefined} onOpenChange={(open) => { if (!open) onDismiss() }}>
      {value !== undefined && (
        <SecretRevealDialogContent
          key={value}
          value={value}
          onDismiss={onDismiss}
          title={title}
          description={description}
          valueLabel={valueLabel}
          copyAriaLabel={copyAriaLabel}
          copiedAnnouncement={copiedAnnouncement}
          doneLabel={doneLabel}
        />
      )}
    </Dialog>
  )
}

function SecretRevealDialogContent({
  value,
  onDismiss,
  title,
  description,
  valueLabel,
  copyAriaLabel,
  copiedAnnouncement,
  doneLabel,
}: Omit<SecretRevealDialogProps, 'value'> & { value: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timeout)
  }, [copied])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-default">{valueLabel}</span>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-default">
            {value}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handleCopy}
            aria-label={copyAriaLabel}
            autoFocus
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          </Button>
        </div>
        <span className="sr-only" aria-live="polite" role="status">
          {copied ? copiedAnnouncement : ''}
        </span>
      </div>

      <DialogFooter>
        <Button type="button" onClick={onDismiss}>
          {doneLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
