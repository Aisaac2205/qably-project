'use client'

/**
 * SuiteForm — full-page create + edit form for suites.
 *
 * One page, two modes:
 *   - `suite` undefined → create mode (calls createSuite)
 *   - `suite` provided  → edit mode (calls updateSuite with the diff)
 * Tags are entered comma-separated and normalized by the store's
 * validateTags (lowercase, deduped, hyphen-safe).
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Suite } from '@qably/types'
import { CaretLeft } from '@phosphor-icons/react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateSuite, useUpdateSuite } from '@/features/projects/suites/hooks/use-suite-mutations'
import type { UpdateSuitePayload } from '@/features/projects/suites/api/suites.api'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { projectSuitesPath } from '@/features/projects/lib/routes'

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag, index) => tag === b[index])
}

export function SuiteForm({ projectId, suite }: { projectId: string; suite?: Suite }) {
  const router = useRouter()
  const { t } = useTranslation()
  const isEdit = suite !== undefined
  const createSuiteMutation = useCreateSuite()
  const updateSuiteMutation = useUpdateSuite()

  const [name, setName] = useState(suite?.name ?? '')
  const [description, setDescription] = useState(suite?.description ?? '')
  const [tags, setTags] = useState(suite?.tags.join(', ') ?? '')
  const [nameError, setNameError] = useState(false)

  const backHref = isEdit ? `/projects/${projectId}/suites/${suite.id}` : projectSuitesPath(projectId)
  const isPending = createSuiteMutation.isPending || updateSuiteMutation.isPending

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
      const trimmedDescription = description.trim()
      const patch: UpdateSuitePayload = {}
      if (trimmed !== suite.name) patch.name = trimmed
      if (trimmedDescription !== suite.description) patch.description = trimmedDescription
      if (!sameTags(tagList, suite.tags)) patch.tags = tagList

      if (Object.keys(patch).length > 0) {
        updateSuiteMutation.mutate({ id: suite.id, patch }, { onSuccess: () => router.push(backHref) })
      } else {
        router.push(backHref)
      }
    } else {
      createSuiteMutation.mutate(
        { projectId, name: trimmed, description: description.trim(), tags: tagList },
        { onSuccess: (created) => router.push(`/projects/${projectId}/suites/${created.id}`) },
      )
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 px-5 py-6 sm:px-7 lg:py-8 animate-page-enter">
      <div className="flex items-center gap-1.5">
        <Link
          href={backHref}
          aria-label={t('common.back')}
          className="shrink-0 size-6 inline-flex items-center justify-center rounded text-muted hover:text-default hover:bg-surface-hover transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
        >
          <CaretLeft size={14} weight="bold" aria-hidden="true" />
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-default">
          {isEdit ? t('suites.editSuite') : t('suites.newSuite')}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card"
        noValidate
      >
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
            rows={4}
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

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link href={backHref} className={cn(buttonVariants({ variant: 'outline' }))}>
            {t('common.cancel')}
          </Link>
          <Button type="submit" disabled={isPending}>
            {isEdit ? t('common.save') : t('suites.createSuite')}
          </Button>
        </div>
      </form>
    </div>
  )
}
