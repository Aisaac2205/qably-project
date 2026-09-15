import * as React from 'react'

import { cn } from '@/lib/utils'

type CardTag = 'div' | 'section' | 'article'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: CardTag
}

function Card({ className, as: Component = 'div', ...props }: CardProps) {
  return (
    <Component
      data-slot="card"
      className={cn(
        'bg-card text-card-foreground rounded-xl border border-border shadow-card',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn('grid grid-cols-[1fr_auto] items-start gap-x-2 p-5', className)}
      {...props}
    />
  )
}

type CardTitleTag = 'h2' | 'h3'

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: CardTitleTag
}

function CardTitle({ className, as: Component = 'h3', ...props }: CardTitleProps) {
  return (
    <Component
      data-slot="card-title"
      className={cn('text-base font-semibold leading-tight tracking-tight', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-content"
      className={cn('p-5 pt-0', className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center p-5 pt-0', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
}
