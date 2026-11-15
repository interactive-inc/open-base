"use client"

import { MenuCheckboxItem, MenuItemIndicator, MenuRadioItem } from "@ui-sdk/react/menu"
import { Menubar as MenubarPrimitive } from "@ui-sdk/react/menubar"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function Menubar({ className, ...props }: React.ComponentProps<typeof MenubarPrimitive>) {
  return (
    <MenubarPrimitive
      className={(state) =>
        cn(
          "flex h-9 items-center rounded-4xl border p-1",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function MenubarMenu({ ...props }: React.ComponentProps<typeof DropdownMenu>) {
  return <DropdownMenu {...props} />
}

function MenubarGroup({ ...props }: React.ComponentProps<typeof DropdownMenuGroup>) {
  return <DropdownMenuGroup {...props} />
}

function MenubarTrigger({ className, ...props }: React.ComponentProps<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      className={(state) =>
        cn(
          "flex select-none items-center rounded-xl px-2 py-0.75 font-medium text-sm outline-hidden hover:bg-muted disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:bg-muted",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function MenubarContent({
  className,
  align = "start",
  alignOffset = -4,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      align={align}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      className={(state) =>
        cn(
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 min-w-48 rounded-2xl bg-popover p-1 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 data-open:animate-in",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function MenubarItem({ className, ...props }: React.ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      className={(state) =>
        cn(
          "group/menubar-item gap-2.5 rounded-xl px-3 py-2 text-sm data-destructive:data-highlighted:bg-destructive/10 data-destructive:data-highlighted:text-destructive data-highlighted:bg-accent data-inset:pl-9.5 data-destructive:text-destructive data-highlighted:text-accent-foreground data-disabled:opacity-50 not-data-destructive:data-highlighted:**:text-accent-foreground dark:data-destructive:data-highlighted:bg-destructive/20 [&_svg:not([class*='size-'])]:size-4 data-destructive:*:[svg]:text-destructive!",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function MenubarCheckboxItem({
  className,
  children,
  checked,
  inset,
  value,
  ...props
}: Omit<React.ComponentProps<typeof MenuCheckboxItem>, "children" | "value"> & {
  inset?: boolean
  value?: string
  children?: React.ReactNode
}) {
  const fallbackValue = React.useId()

  return (
    <MenuCheckboxItem
      data-inset={inset ? "" : undefined}
      className={(state) =>
        cn(
          "relative flex cursor-default select-none items-center gap-2.5 rounded-xl py-2 pr-3 pl-9.5 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:pl-9.5 data-highlighted:text-accent-foreground data-disabled:opacity-50 data-highlighted:**:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      checked={checked}
      value={value ?? fallbackValue}
      {...props}
    >
      <MenuItemIndicator className="pointer-events-none absolute left-3 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
        <CheckIcon />
      </MenuItemIndicator>
      {children}
    </MenuCheckboxItem>
  )
}

function MenubarRadioGroup({ ...props }: React.ComponentProps<typeof DropdownMenuRadioGroup>) {
  return <DropdownMenuRadioGroup {...props} />
}

function MenubarRadioItem({
  className,
  children,
  inset,
  ...props
}: Omit<React.ComponentProps<typeof MenuRadioItem>, "children"> & {
  inset?: boolean
  children?: React.ReactNode
}) {
  return (
    <MenuRadioItem
      data-inset={inset ? "" : undefined}
      className={(state) =>
        cn(
          "relative flex cursor-default select-none items-center gap-2.5 rounded-xl py-2 pr-3 pl-9.5 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:pl-9.5 data-highlighted:text-accent-foreground data-disabled:opacity-50 data-highlighted:**:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      <MenuItemIndicator className="pointer-events-none absolute left-3 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
        <CheckIcon />
      </MenuItemIndicator>
      {children}
    </MenuRadioItem>
  )
}

function MenubarLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenuLabel>) {
  return (
    <DropdownMenuLabel
      className={(state) =>
        cn(
          "px-3.5 py-2.5 text-muted-foreground text-xs data-inset:pl-9.5",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function MenubarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSeparator>) {
  return (
    <DropdownMenuSeparator
      className={(state) =>
        cn(
          "-mx-1 my-1 h-px bg-border/50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function MenubarShortcut({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuShortcut>) {
  return (
    <DropdownMenuShortcut
      className={(state) =>
        cn(
          "ml-auto text-muted-foreground text-xs tracking-widest group-data-highlighted/menubar-item:text-accent-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function MenubarSub({ ...props }: React.ComponentProps<typeof DropdownMenuSub>) {
  return <DropdownMenuSub {...props} />
}

function MenubarSubTrigger({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSubTrigger>) {
  return (
    <DropdownMenuSubTrigger
      className={(state) =>
        cn(
          "gap-2 rounded-xl px-3 py-2 text-sm data-highlighted:bg-accent data-open:bg-accent data-inset:pl-9.5 data-highlighted:text-accent-foreground data-open:text-accent-foreground [&_svg:not([class*='size-'])]:size-4",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function MenubarSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSubContent>) {
  return (
    <DropdownMenuSubContent
      className={(state) =>
        cn(
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 min-w-32 rounded-2xl bg-popover p-1 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 data-ending-style:animate-out data-open:animate-in",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createMenubarController } from "@ui-sdk/react/menubar"
export {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
}
