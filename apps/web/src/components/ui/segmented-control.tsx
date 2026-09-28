'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  id?: string
  controls?: string
}

interface SegmentedControlProps<T extends string> {
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  semantics?: 'tabs' | 'toggle'
  size?: 'sm' | 'md'
  className?: string
}

const SIZES = {
  sm: 'min-h-7 px-3 text-xs',
  md: 'min-h-8 px-3.5 text-sm',
} as const

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  semantics = 'toggle',
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const isTabs = semantics === 'tabs'
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isTabs) return

    const current = options.findIndex((option) => option.value === value)
    const last = options.length - 1
    let next: number

    switch (event.key) {
      case 'ArrowRight':
        next = current === last ? 0 : current + 1
        break
      case 'ArrowLeft':
        next = current <= 0 ? last : current - 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = last
        break
      default:
        return
    }

    const option = options[next]
    if (option === undefined) return

    event.preventDefault()
    onChange(option.value)
    itemsRef.current[next]?.focus()
  }

  return (
    <div
      role={isTabs ? 'tablist' : 'group'}
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border bg-canvas p-0.5',
        className,
      )}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value

        return (
          <button
            key={option.value}
            ref={(node) => {
              itemsRef.current[index] = node
            }}
            type="button"
            id={option.id}
            role={isTabs ? 'tab' : undefined}
            aria-selected={isTabs ? isSelected : undefined}
            aria-pressed={isTabs ? undefined : isSelected}
            aria-controls={isTabs ? option.controls : undefined}
            tabIndex={isTabs && !isSelected ? -1 : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap',
              'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
              'transition-[background-color,color,box-shadow] duration-150',
              SIZES[size],
              isSelected
                ? 'border border-primary/60 bg-surface text-default'
                : 'border border-transparent text-muted hover:text-default',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
