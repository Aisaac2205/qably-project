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
import { useTranslation } from '@/lib/i18n'

const GITHUB_REPO_RE = /^[\w-]+\/[\w-]+$/

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
  const updateProject = useUpdateProject()
  const { t } = useTranslation()

  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [githubRepo, setGithubRepo] = useState(project.githubRepo ?? '')
  const [technologies, setTechnologies] = useState<string[]>(project.technologies ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})

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
    if (githubRepo.trim() && !GITHUB_REPO_RE.test(githubRepo.trim())) {
      errs.githubRepo = t('projects.formatOrgRepoError')
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    updateProject(project.id, {
      name: name.trim(),
      description: description.trim(),
      githubRepo: githubRepo.trim(),
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
          <Label htmlFor="edit-project-repo">{t('projects.githubRepoLabel')}</Label>
          <Input
            id="edit-project-repo"
            value={githubRepo}
            onChange={(e) => {
              setGithubRepo(e.target.value)
              clearError('githubRepo')
            }}
            placeholder={t('projects.githubRepoPlaceholder')}
            aria-invalid={!!errors.githubRepo}
          />
          {errors.githubRepo && (
            <p role="alert" className="text-xs text-fail">
              {errors.githubRepo}
            </p>
          )}
        </div>

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
