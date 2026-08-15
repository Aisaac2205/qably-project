import type { FormEvent, FormEventHandler, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  label: string
  children: ReactNode
  className?: string
  onSubmit?: FormEventHandler<HTMLFormElement>
}

export function FilterBar({ label, children, className, onSubmit }: FilterBarProps) {
  function preventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit?.(event)
  }

  return (
    <form
      role="search"
      aria-label={label}
      onSubmit={preventSubmit}
      className={cn('grid grid-cols-2 gap-2 md:flex md:items-center', className)}
    >
      {children}
    </form>
  )
}
