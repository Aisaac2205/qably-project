import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EntityListProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode
}

export function EntityList({ children, className, ...props }: EntityListProps) {
  return (
    <ul className={cn('divide-y divide-border', className)} {...props}>
      {children}
    </ul>
  )
}
