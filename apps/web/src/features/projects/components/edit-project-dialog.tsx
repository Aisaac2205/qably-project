'use client'

import { useState, useEffect } from 'react'
import type { Project } from '@qably/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { TechSelector } from './tech-selector'
import { useUpdateProject } from '../hooks/use-update-project'

interface EditProjectDialogProps {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditProjectDialog({ project, open, onOpenChange }: EditProjectDialogProps) {
  const updateProject = useUpdateProject()
  const [technologies, setTechnologies] = useState<string[]>(project.technologies ?? [])

  useEffect(() => {
    if (open) setTechnologies(project.technologies ?? [])
  }, [open, project.technologies])

  function handleSave() {
    updateProject(project.id, { technologies })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit tech stack</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">{project.name}</p>

        <TechSelector selected={technologies} onChange={setTechnologies} />

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 rounded border border-border text-sm text-default hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 rounded bg-primary text-primary-fg text-sm font-semibold hover:bg-primary-hover transition-colors"
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
