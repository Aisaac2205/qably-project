import type { ComponentType, ReactNode } from 'react'

export interface LinkProps {
  href: string
  className?: string
  children: ReactNode
  'aria-label'?: string
}

export type LinkComponent = ComponentType<LinkProps>

export function DefaultLink({ href, className, children, ...rest }: LinkProps) {
  return (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  )
}
