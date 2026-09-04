'use client'

import * as React from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { CaretUpDown, Check, CaretDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export type SelectRootProps = React.ComponentProps<typeof SelectPrimitive.Root>
export type SelectGroupProps = React.ComponentProps<typeof SelectPrimitive.Group>
export type SelectValueProps = React.ComponentProps<typeof SelectPrimitive.Value>
export type SelectTriggerProps = React.ComponentProps<typeof SelectPrimitive.Trigger>
export type SelectContentProps = SelectPrimitive.Popup.Props & {
  readonly sideOffset?: number
}
export type SelectItemProps = SelectPrimitive.Item.Props

function Select({ ...props }: SelectRootProps) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({ ...props }: SelectGroupProps) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({ className, ...props }: SelectValueProps) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn('text-xs font-medium text-default', className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        'flex h-9 w-full items-center justify-between gap-2.5 rounded-lg border border-border bg-canvas px-3 py-1.5 text-xs font-medium text-default select-none shadow-xs outline-none transition-all duration-150 ease-out',
        'placeholder:text-muted',
        'hover:border-border-strong hover:bg-canvas-hover',
        'focus:outline-none focus-visible:outline-2 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-canvas-hover/40',
        'data-[popup-open]:bg-surface data-[popup-open]:border-border-strong',
        '[&>span]:line-clamp-1',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="flex shrink-0 text-muted">
        <CaretUpDown size={13} weight="bold" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        sideOffset={sideOffset}
        className="isolate z-50 outline-none"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'relative z-50 max-h-60 min-w-[var(--anchor-width)] origin-(--transform-origin) overflow-y-auto rounded-lg border border-border bg-surface py-1 text-default shadow-pop outline-none duration-150',
            'data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
            className,
          )}
          {...props}
        >
          <SelectPrimitive.ScrollUpArrow className="flex h-5 items-center justify-center bg-surface text-muted">
            <CaretDown size={11} className="rotate-180" />
          </SelectPrimitive.ScrollUpArrow>
          <SelectPrimitive.List className="p-1">
            {children}
          </SelectPrimitive.List>
          <SelectPrimitive.ScrollDownArrow className="flex h-5 items-center justify-center bg-surface text-muted">
            <CaretDown size={11} />
          </SelectPrimitive.ScrollDownArrow>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center justify-between rounded-md px-3 py-1.5 text-xs text-default outline-none transition-colors',
        'data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex items-center gap-2">
        {children}
      </SelectPrimitive.ItemText>
      <span className="ml-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check size={12} weight="bold" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

export interface SelectOption<T = string | number | null> {
  readonly label: string
  readonly value: T
  readonly badge?: string | number | null
  readonly icon?: React.ReactNode
}

export interface SelectSimpleProps<T = string | number | null> {
  readonly options: readonly SelectOption<T>[]
  readonly value?: T
  readonly onValueChange?: (value: T) => void
  readonly placeholder?: string
  readonly className?: string
  readonly triggerClassName?: string
  readonly badgeInTrigger?: boolean
}

/**
 * Shorthand declarative Select component for option lists with circular badge support.
 * Set `badgeInTrigger` to false when the surrounding layout already states the active
 * option's count, so the trigger does not repeat it.
 */
function SelectSimple<T extends string | number | null>({
  options,
  value,
  onValueChange,
  placeholder,
  triggerClassName,
  badgeInTrigger = true,
}: SelectSimpleProps<T>) {
  const activeOption = options.find((o) => o.value === value)

  return (
    <Select
      value={value}
      onValueChange={(val) => onValueChange?.(val as T)}
    >
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder}>
          {activeOption ? (
            <span className="flex items-center gap-1.5">
              {activeOption.icon && (
                <span className="shrink-0 text-muted">{activeOption.icon}</span>
              )}
              <span>{activeOption.label}</span>
              {badgeInTrigger && activeOption.badge !== undefined && activeOption.badge !== null && (
                <span className="inline-flex items-center justify-center rounded-full bg-border/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted">
                  {typeof activeOption.badge === 'number'
                    ? activeOption.badge.toLocaleString()
                    : activeOption.badge}
                </span>
              )}
            </span>
          ) : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={`${opt.label}-${opt.value}`} value={opt.value}>
            <span className="flex items-center gap-1.5">
              {opt.icon && <span className="shrink-0 text-muted">{opt.icon}</span>}
              <span>{opt.label}</span>
              {opt.badge !== undefined && opt.badge !== null && (
                <span className="inline-flex items-center justify-center rounded-full bg-border/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted">
                  {typeof opt.badge === 'number'
                    ? opt.badge.toLocaleString()
                    : opt.badge}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectSimple,
}

export default SelectSimple
