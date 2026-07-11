"use client"

import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "@/lib/utils"

function Menu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="menu" {...props} />
}

function MenuTrigger({ className, ...props }: MenuPrimitive.Trigger.Props) {
  return (
    <MenuPrimitive.Trigger
      data-slot="menu-trigger"
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

function MenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="menu-portal" {...props} />
}

function MenuPositioner({ className, ...props }: MenuPrimitive.Positioner.Props) {
  return (
    <MenuPrimitive.Positioner
      data-slot="menu-positioner"
      sideOffset={4}
      className={cn("isolate z-50", className)}
      {...props}
    />
  )
}

function MenuContent({ className, children, ...props }: MenuPrimitive.Popup.Props) {
  return (
    <MenuPrimitive.Popup
      data-slot="menu-content"
      className={cn(
        "relative z-50 min-w-[10rem] origin-(--transform-origin) overflow-hidden rounded-md border border-border bg-surface p-1 text-default shadow-md duration-200",
        "data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
        className,
      )}
      {...props}
    >
      {children}
    </MenuPrimitive.Popup>
  )
}

function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
        "data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Menu, MenuTrigger, MenuPortal, MenuPositioner, MenuContent, MenuItem }
