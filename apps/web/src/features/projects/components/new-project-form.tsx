'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateProject } from '../hooks/use-create-project'
import { useConnections } from '@/features/integrations/hooks/use-connections'
import { TechSelector } from './tech-selector'
import { useTranslation } from '@/lib/i18n'

export function NewProjectForm() {
  const { mutate: createProject, isPending, error } = useCreateProject()
  const router = useRouter()
  const { t } = useTranslation()
  const { connections } = useConnections()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const [technologies, setTechnologies] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = t('projects.nameRequired')
    return errs
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    createProject({
      name: name.trim(),
      description: description.trim() || undefined,
      connectionId: connectionId || undefined,
      technologies,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-4">
      <h1 className="text-lg font-semibold text-default">{t('projects.newProject')}</h1>

      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-xs font-semibold text-default">
          {t('projects.projectNameLabel')} <span aria-hidden="true">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors((prev) => { const next = { ...prev }; delete next.name; return next }) }}
          className="w-full px-2.5 py-1.5 rounded border border-border bg-surface text-default text-sm focus:outline-none focus:border-primary transition-colors"
          aria-required="true"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
          autoFocus
        />
        {errors.name && (
          <p id="name-error" className="text-xs text-fail" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-xs font-semibold text-default">
          {t('projects.descriptionLabel')} <span className="text-muted font-normal">({t('common.optional')})</span>
        </label>
        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-2.5 py-1.5 rounded border border-border bg-surface text-default text-sm focus:outline-none focus:border-primary transition-colors resize-y"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="connectionId" className="block text-xs font-semibold text-default">
          {t('projects.repoConnectionLabel')} <span className="text-muted font-normal">({t('projects.repoConnectionHint')})</span>
        </label>
        <select
          id="connectionId"
          name="connectionId"
          value={connectionId}
          onChange={(e) => setConnectionId(e.target.value)}
          disabled={connections.length === 0}
          className="w-full px-2.5 py-1.5 rounded border border-border bg-surface text-default text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
          aria-describedby={connections.length === 0 ? 'connection-empty' : undefined}
        >
          <option value="">{t('projects.repoConnectionNone')}</option>
          {connections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.repo}
            </option>
          ))}
        </select>
        {connections.length === 0 && (
          <p id="connection-empty" className="text-xs text-muted">
            {t('projects.repoConnectionEmpty')}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-default">
          {t('projects.techStackLabel')} <span className="text-muted font-normal">({t('common.optional')})</span>
        </p>
        <TechSelector selected={technologies} onChange={setTechnologies} />
      </div>

      {error && (
        <p
          className="rounded border border-fail/30 bg-fail-bg px-3 py-2 text-xs text-fail"
          role="alert"
        >
          {error.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="min-h-11 px-4 py-2 rounded border border-border bg-surface text-default text-sm font-semibold hover:bg-surface-hover transition-colors focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 px-4 py-2 rounded bg-primary text-primary-fg text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary"
        >
          {isPending ? t('projects.creating') : t('projects.createProject')}
        </button>
      </div>
    </form>
  )
}
