'use client'

import Link from 'next/link'
import { CaretRight } from '@phosphor-icons/react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <ol className="flex items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={index} className="flex items-center gap-1">
              {isLast ? (
                <span
                  className="text-default font-semibold truncate max-w-[180px]"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="text-muted hover:text-default transition-colors truncate max-w-[140px]"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-muted truncate max-w-[140px]">{item.label}</span>
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
