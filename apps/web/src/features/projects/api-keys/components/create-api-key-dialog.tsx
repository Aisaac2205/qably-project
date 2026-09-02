'use client'

import { useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/lib/i18n'

const MAX_NAME_LENGTH = 80

interface CreateApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => void
  isSubmitting: boolean
  error?: string
}

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
}: CreateApiKeyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CreateApiKeyDialogContent
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          error={error}
        />
      )}
    </Dialog>
  )
}

function CreateApiKeyDialogContent({
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
}: Omit<CreateApiKeyDialogProps, 'open'>) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [validationError, setValidationError] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setValidationError(t('apiKeys.nameRequired'))
      return
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      setValidationError(t('apiKeys.nameTooLong'))
      return
    }
    setValidationError('')
    onSubmit(trimmed)
  }

  const displayedError = validationError || error

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{t('apiKeys.createTitle')}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="api-key-name">{t('apiKeys.nameLabel')}</Label>
          <Input
            id="api-key-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (validationError) setValidationError('')
            }}
            placeholder={t('apiKeys.namePlaceholder')}
            aria-invalid={Boolean(displayedError)}
            autoFocus
            disabled={isSubmitting}
          />
          {displayedError && (
            <p role="alert" className="text-xs text-fail">
              {displayedError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('apiKeys.creating') : t('apiKeys.createKey')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
