import { cn } from '@/lib/utils'

export interface ProjectMonogramProps {
  projectId: string
  name: string
  className?: string
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase()

  return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase()
}

export function ProjectMonogram({ name, className }: ProjectMonogramProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
        'bg-canvas-hover text-default',
        className,
      )}
    >
      {initialsFor(name)}
    </span>
  )
}
