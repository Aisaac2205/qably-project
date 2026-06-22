'use client'

import { useState, type FormEvent } from 'react'
import { useCreateProject } from '../hooks/use-create-project'
import { TechSelector } from './tech-selector'

const GITHUB_REPO_RE = /^[\w-]+\/[\w-]+$/

export function NewProjectForm() {
  const createProject = useCreateProject()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [githubRepo, setGithubRepo] = useState('')
  const [technologies, setTechnologies] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Project name is required'
    if (githubRepo.trim() && !GITHUB_REPO_RE.test(githubRepo.trim())) {
      errs.githubRepo = 'Format must be org/repo'
    }
    return errs
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 200))
    createProject({
      name: name.trim(),
      description: description.trim() || undefined,
      githubRepo: githubRepo.trim() || undefined,
      technologies,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-4">
      <h1 className="text-lg font-semibold text-default">New Project</h1>

      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-xs font-semibold text-default">
          Project name <span aria-hidden="true">*</span>
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
          <p id="name-error" className="text-[11px] text-fail" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-xs font-semibold text-default">
          Description <span className="text-muted font-normal">(optional)</span>
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
        <label htmlFor="githubRepo" className="block text-xs font-semibold text-default">
          GitHub repo <span className="text-muted font-normal">(optional, org/repo)</span>
        </label>
        <input
          id="githubRepo"
          name="githubRepo"
          type="text"
          value={githubRepo}
          onChange={(e) => { setGithubRepo(e.target.value); setErrors((prev) => { const next = { ...prev }; delete next.githubRepo; return next }) }}
          placeholder="org/repo"
          className="w-full px-2.5 py-1.5 rounded border border-border bg-surface text-default text-sm focus:outline-none focus:border-primary transition-colors"
          aria-invalid={!!errors.githubRepo}
          aria-describedby={errors.githubRepo ? 'repo-error' : undefined}
        />
        {errors.githubRepo && (
          <p id="repo-error" className="text-[11px] text-fail" role="alert">
            {errors.githubRepo}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-default">
          Tech stack <span className="text-muted font-normal">(optional)</span>
        </p>
        <TechSelector selected={technologies} onChange={setTechnologies} />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-4 py-2 rounded bg-primary text-primary-fg text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary"
      >
        {isSubmitting ? 'Creating…' : 'Create project'}
      </button>
    </form>
  )
}
