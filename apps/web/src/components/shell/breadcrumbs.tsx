'use client'

import Link from 'next/link'
import { CaretRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Below `md`, only the immediate parent and the current page stay visible —
 * a long trail (Projects › Project name › Suites › Suite name) otherwise
 * overruns narrow viewports even with per-crumb truncation. The collapsed
 * crumbs stay in the DOM (for SEO/assistive tech) and reappear at `md`+,
 * with a visual ellipsis marking that the trail continues above.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null

  const firstVisibleOnMobile = Math.max(items.length - 2, 0)
  const hasCollapsedCrumbs = items.length > 2

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex min-w-0 flex-1 items-center gap-1 text-sm', className)}
    >
      <ol className="flex w-full min-w-0 items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const collapsedOnMobile = hasCollapsedCrumbs && index < firstVisibleOnMobile

          return (
            <li
              key={index}
              className={cn(
                'flex min-w-0 items-center gap-1',
                isLast ? 'shrink' : 'shrink-[3]',
                collapsedOnMobile && 'hidden md:flex',
              )}
            >
              {index === firstVisibleOnMobile && hasCollapsedCrumbs && (
                <span className="flex items-center gap-1 text-muted md:hidden" aria-hidden="true">
                  <span>…</span>
                  <CaretRight size={12} weight="bold" className="shrink-0" />
                </span>
              )}

              {isLast ? (
                <span
                  className="min-w-0 truncate text-sm font-semibold text-default max-w-[60vw] md:max-w-none"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="min-w-0 truncate text-xs text-muted transition-colors hover:text-default max-w-[28vw] md:max-w-none md:text-sm"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="min-w-0 truncate text-xs text-muted max-w-[28vw] md:max-w-none md:text-sm">
                  {item.label}
                </span>
              )}

              {!isLast && (
                <CaretRight
                  size={12}
                  weight="bold"
                  className="text-muted shrink-0"
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
