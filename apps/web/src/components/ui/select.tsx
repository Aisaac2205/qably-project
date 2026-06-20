"use client"

import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CaretDown, Check } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

type SelectRootProps = React.ComponentProps<typeof SelectPrimitive.Root>
type SelectGroupProps = React.ComponentProps<typeof SelectPrimitive.Group>
type SelectValueProps = React.ComponentProps<typeof SelectPrimitive.Value>
type SelectTriggerProps = React.ComponentProps<typeof SelectPrimitive.Trigger>

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
      className={cn("text-sm text-foreground", className)}
      {...props}
    />
  )
}

function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1 text-sm outline-none transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "[&>span]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <CaretDown className="size-4 shrink-0 text-muted-foreground" weight="bold" />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Backdrop />
      <SelectPrimitive.Positioner
        sideOffset={4}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "relative z-50 max-h-60 min-w-[8rem] origin-(--transform-origin) overflow-hidden rounded-md border border-border bg-background text-foreground shadow-md duration-200",
            "data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
            className,
          )}
          {...props}
        >
          <SelectPrimitive.ScrollUpArrow className="flex h-6 items-center justify-center bg-background">
            <CaretDown className="size-4 rotate-180" />
          </SelectPrimitive.ScrollUpArrow>
          <SelectPrimitive.List className="p-1">
            {children}
          </SelectPrimitive.List>
          <SelectPrimitive.ScrollDownArrow className="flex h-6 items-center justify-center bg-background">
            <CaretDown className="size-4" />
          </SelectPrimitive.ScrollDownArrow>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
        "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" weight="bold" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("-mx-1 my-1 h-px bg-muted", className)}
      {...props}
    />
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
}
