'use client'

/**
 * SuiteFormDialog — create + edit form for suites.
 *
 * One dialog, two modes:
 *   - `suite` undefined → create mode (calls createSuite)
 *   - `suite` provided  → edit mode (calls updateSuite with the diff)
 * Tags are entered comma-separated and normalized by the store's
 * validateTags (lowercase, deduped, hyphen-safe).
 */
import { useEffect, useState } from 'react'
import type { Suite } from '@qably/types'
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
import { Textarea } from '@/components/ui/textarea'
import { createSuite, updateSuite } from '@/lib/mock-store'
import { useTranslation } from '@/lib/i18n'

interface SuiteFormDialogProps {
  projectId: string
  suite?: Suite
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SuiteFormDialog({ projectId, suite, open, onOpenChange }: SuiteFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = suite !== undefined

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [nameError, setNameError] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(suite?.name ?? '')
    setDescription(suite?.description ?? '')
    setTags(suite?.tags.join(', ') ?? '')
    setNameError(false)
  }, [open, suite])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError(true)
      return
    }
    const tagList = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    if (isEdit) {
      updateSuite(suite.id, { name: trimmed, description: description.trim(), tags: tagList })
    } else {
      createSuite({ projectId, name: trimmed, description: description.trim(), tags: tagList })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('suites.editSuite') : t('suites.newSuite')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="suite-name">{t('suites.suiteNameLabel')}</Label>
            <Input
              id="suite-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(false)
              }}
              placeholder={t('suites.suiteNamePlaceholder')}
              aria-invalid={nameError}
              autoFocus
            />
            {nameError && (
              <p role="alert" className="text-xs text-fail">
                {t('suites.suiteNameRequired')}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="suite-description">{t('suites.suiteDescriptionLabel')}</Label>
            <Textarea
              id="suite-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('suites.suiteDescriptionPlaceholder')}
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="suite-tags">{t('suites.tagsLabel')}</Label>
            <Input
              id="suite-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('suites.tagsPlaceholder')}
              aria-describedby="suite-tags-hint"
            />
            <p id="suite-tags-hint" className="text-xs text-muted">
              {t('suites.tagsHint')}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{isEdit ? t('common.save') : t('suites.createSuite')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
