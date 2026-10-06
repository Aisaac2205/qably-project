import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EntityListProps extends ComponentProps<'ul'> {
  children: ReactNode
}

export function EntityList({ children, className, ...props }: EntityListProps) {
  return (
    <ul className={cn('divide-y divide-border', className)} {...props}>
      {children}
    </ul>
  )
}
