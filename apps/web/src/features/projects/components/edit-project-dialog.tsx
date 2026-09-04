'use client'

/**
 * EditProjectDialog — full project edit form.
 *
 * Covers name, description, GitHub repo and tech stack. Same
 * validation rules as the create form (name required, repo must be
 * org/repo). Delete lives on the card's kebab menu, not here —
 * destructive actions get their own confirmation dialog.
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { Project } from '@qably/types'
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
import { TechSelector } from './tech-selector'
import { useUpdateProject } from '../hooks/use-update-project'
import { useConnections } from '@/features/integrations/hooks/use-connections'
import { rotateConnectionWebhookSecret } from '@/features/integrations/api/connections.api'
import { WebhookSetupPanel } from '@/features/integrations'
import { useTranslation } from '@/lib/i18n'

interface EditProjectDialogProps {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditProjectDialog({ project, open, onOpenChange }: EditProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <EditProjectDialogContent key={project.id} project={project} onOpenChange={onOpenChange} />}
    </Dialog>
  )
}

function EditProjectDialogContent({
  project,
  onOpenChange,
}: Omit<EditProjectDialogProps, 'open'>) {
  const { update: updateProject } = useUpdateProject()
  const { t } = useTranslation()
  const { connections } = useConnections()

  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [connectionId, setConnectionId] = useState(project.connectionId ?? '')
  const [technologies, setTechnologies] = useState<string[]>(project.technologies ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [setupExpanded, setSetupExpanded] = useState(false)
  const [confirmingRotate, setConfirmingRotate] = useState(false)
  const [revealedSecret, setRevealedSecret] = useState<string | undefined>(undefined)

  const selectedConnection = connections.find((c) => c.id === connectionId)

  const rotateMutation = useMutation({
    mutationFn: (id: string) => rotateConnectionWebhookSecret(id),
  })

  function handleConfirmRotate() {
    if (!selectedConnection) return
    setConfirmingRotate(false)
    rotateMutation.mutate(selectedConnection.id, {
      onSuccess: (result) => setRevealedSecret(result.webhookSecret),
    })
  }

  function clearError(field: string) {
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = t('projects.nameRequiredError')
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    updateProject(project.id, {
      name: name.trim(),
      description: description.trim() || null,
      connectionId: connectionId || null,
      technologies,
    })
    onOpenChange(false)
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{t('projects.editProjectTitle')}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="edit-project-name">
            {t('projects.projectNameLabel')} <span aria-hidden="true">*</span>
          </Label>
          <Input
            id="edit-project-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              clearError('name')
            }}
            aria-required="true"
            aria-invalid={!!errors.name}
            autoFocus
          />
          {errors.name && (
            <p role="alert" className="text-xs text-fail">
              {errors.name}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-project-description">{t('projects.descriptionLabel')}</Label>
          <Textarea
            id="edit-project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-project-repo">{t('projects.repoConnectionLabel')}</Label>
          <select
            id="edit-project-repo"
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
            disabled={connections.length === 0}
            className="w-full px-2.5 py-1.5 rounded border border-border bg-surface text-default text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
            aria-describedby={connections.length === 0 ? 'edit-connection-empty' : undefined}
          >
            <option value="">{t('projects.repoConnectionNone')}</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.repo}
              </option>
            ))}
          </select>
          {connections.length === 0 && (
            <p id="edit-connection-empty" className="text-xs text-muted">
              {t('projects.repoConnectionEmpty')}
            </p>
          )}
        </div>

        {selectedConnection && (
          <div className="grid gap-2 rounded-lg border border-border bg-canvas/40 p-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit justify-start"
              aria-expanded={setupExpanded}
              onClick={() => setSetupExpanded((prev) => !prev)}
            >
              {setupExpanded ? t('webhookSetup.hideSetup') : t('webhookSetup.viewSetup')}
            </Button>

            {setupExpanded && (
              <div className="space-y-3">
                <WebhookSetupPanel provider={selectedConnection.provider} secret={revealedSecret} />

                {revealedSecret !== undefined ? (
                  <Button type="button" size="sm" onClick={() => setRevealedSecret(undefined)}>
                    {t('repository.done')}
                  </Button>
                ) : confirmingRotate ? (
                  <div className="space-y-2 rounded-lg border border-warn/30 bg-warn-bg p-3">
                    <p className="text-xs font-semibold text-warn">
                      {t('webhookSetup.regenerateConfirmTitle')}
                    </p>
                    <p className="text-xs text-warn">
                      {t('webhookSetup.regenerateConfirmDescription')}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmingRotate(false)}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleConfirmRotate}
                        autoFocus
                      >
                        {t('webhookSetup.regenerateConfirmAction')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmingRotate(true)}
                    disabled={rotateMutation.isPending}
                  >
                    {rotateMutation.isPending
                      ? t('repository.rotating')
                      : t('webhookSetup.regenerateSecret')}
                  </Button>
                )}

                {rotateMutation.isError && (
                  <p role="alert" className="text-xs text-fail">
                    {t('webhookSetup.regenerateError')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-2">
          <p className="text-sm font-medium leading-none text-foreground">
            {t('projects.techStackLabel')}
          </p>
          <TechSelector selected={technologies} onChange={setTechnologies} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('common.save')}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
