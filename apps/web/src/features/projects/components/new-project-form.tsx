'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { RepoConnectionProvider } from '@qably/types'
import { useCreateProject } from '../hooks/use-create-project'
import type { CreateProjectPayload } from '../api/projects.api'
import { useConnections } from '@/features/integrations/hooks/use-connections'
import { useAvailableRepos } from '@/features/integrations/hooks/use-available-repos'
import { RepoPicker } from '@/features/integrations/components/repo-picker'
import { createConnection } from '@/features/integrations/api/connections.api'
import { useDetectedStack } from '@/features/integrations/hooks/use-detected-stack'
import { WebhookSetupPanel } from '@/features/integrations'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { REPO_OPTION_PREFIX, buildRepoOptions } from '../lib/repo-options'
import { DetectedStack } from './detected-stack'
import { useTranslation } from '@/lib/i18n'

interface PendingWebhookSetup {
  connectionId: string
  provider: RepoConnectionProvider
  secret: string
  payload: CreateProjectPayload
}

export function NewProjectForm() {
  const { mutate: createProject, isPending, error } = useCreateProject()
  const router = useRouter()
  const { t } = useTranslation()
  const { connections } = useConnections()
  const { repos, isLoading: reposLoading, refresh } = useAvailableRepos()
  const repoOptions = buildRepoOptions(connections, repos)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const [dropped, setDropped] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pendingSetup, setPendingSetup] = useState<PendingWebhookSetup | null>(null)

  const selectedRepo =
    repoOptions.find((option) => option.value === connectionId)?.repo ?? null
  const { technologies: detected, isDetecting } = useDetectedStack(selectedRepo)
  const technologies = detected.filter((tech) => !dropped.includes(tech))


  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = t('projects.nameRequired')
    return errs
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setErrors({})

    const payload: CreateProjectPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      connectionId: connectionId === '' ? undefined : connectionId,
      technologies,
    }

    if (connectionId === '' || !connectionId.startsWith(REPO_OPTION_PREFIX)) {
      createProject(payload)
      return
    }

    const repo = connectionId.slice(REPO_OPTION_PREFIX.length)

    try {
      const connection = await createConnection({
        provider: 'GITHUB',
        name: repo,
        repo,
      })

      setPendingSetup({
        connectionId: connection.id,
        provider: connection.provider,
        secret: connection.webhookSecret,
        payload,
      })
    } catch {
      setErrors({ connectionId: t('projects.repoConnectionFailed') })
    }
  }

  function handleContinueSetup() {
    if (pendingSetup === null) return
    const { connectionId: resolvedConnectionId, payload } = pendingSetup
    setPendingSetup(null)
    createProject({ ...payload, connectionId: resolvedConnectionId })
  }

  return (
    <>
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
        <p className="text-xs font-semibold text-default" id="repo-picker-label">
          {t('projects.repoConnectionLabel')}{' '}
          <span className="font-normal text-muted">
            ({t('projects.repoConnectionHint')})
          </span>
        </p>
        <RepoPicker
          options={repoOptions}
          value={connectionId}
          onChange={setConnectionId}
          onRefresh={refresh}
          isLoading={reposLoading}
        />
        {errors.connectionId && (
          <p className="text-xs text-fail" role="alert">
            {errors.connectionId}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-default">
          {t('projects.techStackLabel')}
        </p>
        <DetectedStack
          technologies={technologies}
          onChange={(kept) =>
            setDropped(detected.filter((tech) => !kept.includes(tech)))
          }
          isDetecting={isDetecting}
        />
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

    <Dialog
      open={pendingSetup !== null}
      onOpenChange={(open) => {
        if (!open) setPendingSetup(null)
      }}
    >
      {pendingSetup !== null && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('webhookSetup.heading')}</DialogTitle>
            <DialogDescription>{t('webhookSetup.introCreated')}</DialogDescription>
          </DialogHeader>

          <WebhookSetupPanel provider={pendingSetup.provider} secret={pendingSetup.secret} />

          <DialogFooter>
            <Button type="button" onClick={handleContinueSetup}>
              {t('webhookSetup.continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
    </>
  )
}
