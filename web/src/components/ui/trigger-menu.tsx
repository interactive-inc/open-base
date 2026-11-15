"use client"

import {
  TriggerMenuContent as TriggerMenuContentPrimitive,
  TriggerMenuEmpty as TriggerMenuEmptyPrimitive,
  TriggerMenuGroupLabel as TriggerMenuGroupLabelPrimitive,
  TriggerMenuGroup as TriggerMenuGroupPrimitive,
  TriggerMenuHint as TriggerMenuHintPrimitive,
  TriggerMenuInput as TriggerMenuInputPrimitive,
  TriggerMenuItemIcon as TriggerMenuItemIconPrimitive,
  TriggerMenuItem as TriggerMenuItemPrimitive,
  TriggerMenuItems,
  TriggerMenuList as TriggerMenuListPrimitive,
  TriggerMenu as TriggerMenuPrimitive,
  TriggerMenuSeparator as TriggerMenuSeparatorPrimitive,
  TriggerMenuStatus as TriggerMenuStatusPrimitive,
} from "@ui-sdk/react/trigger-menu"
import { cn } from "cn"
import type * as React from "react"

const TriggerMenu = TriggerMenuPrimitive

function TriggerMenuInput({
  className,
  ...props
}: React.ComponentProps<typeof TriggerMenuInputPrimitive>) {
  return (
    <TriggerMenuInputPrimitive
      className={(state) =>
        cn(
          "field-sizing-content flex min-h-16 w-full resize-none rounded-xl border border-input bg-input/30 px-3 py-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&:is(input)]:h-9 [&:is(input)]:min-h-0 [&:is(input)]:rounded-4xl [&:is(input)]:py-1",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TriggerMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TriggerMenuContentPrimitive>) {
  return (
    <TriggerMenuContentPrimitive
      sideOffset={sideOffset}
      className={(state) =>
        cn(
          "group/trigger-menu-content data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 relative z-50 max-h-(--available-height) w-64 max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 [--trigger-menu-available-height:var(--available-height)] data-ending-style:animate-out data-open:animate-in data-[trigger='/']:font-mono",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TriggerMenuList({
  className,
  ...props
}: React.ComponentProps<typeof TriggerMenuListPrimitive>) {
  return (
    <TriggerMenuListPrimitive
      className={(state) =>
        cn(
          "no-scrollbar max-h-[min(--spacing(72),var(--trigger-menu-available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1 empty:hidden aria-busy:opacity-60",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TriggerMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof TriggerMenuItemPrimitive>) {
  return (
    <TriggerMenuItemPrimitive
      className={(state) =>
        cn(
          "relative flex w-full cursor-default select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-hidden data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TriggerMenuItemIcon({
  className,
  ...props
}: React.ComponentProps<typeof TriggerMenuItemIconPrimitive>) {
  return (
    <TriggerMenuItemIconPrimitive
      className={(state) =>
        cn(
          "flex shrink-0 items-center text-muted-foreground data-mirror:rtl:-scale-x-100",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TriggerMenuGroup({
  className,
  ...props
}: React.ComponentProps<typeof TriggerMenuGroupPrimitive>) {
  return (
    <TriggerMenuGroupPrimitive
      className={(state) =>
        cn("scroll-my-1", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function TriggerMenuGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof TriggerMenuGroupLabelPrimitive>) {
  return (
    <TriggerMenuGroupLabelPrimitive
      className={(state) =>
        cn(
          "px-3 py-2 font-sans text-muted-foreground text-xs",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TriggerMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof TriggerMenuSeparatorPrimitive>) {
  return (
    <TriggerMenuSeparatorPrimitive
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

function TriggerMenuEmpty({
  className,
  ...props
}: React.ComponentProps<typeof TriggerMenuEmptyPrimitive>) {
  return (
    <TriggerMenuEmptyPrimitive
      className={(state) =>
        cn(
          "hidden w-full justify-center py-3 text-center font-sans text-muted-foreground text-sm data-empty:flex data-loading:flex",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TriggerMenuHint({
  className,
  ...props
}: React.ComponentProps<typeof TriggerMenuHintPrimitive>) {
  return (
    <TriggerMenuHintPrimitive
      className={(state) =>
        cn(
          "pointer-events-none text-muted-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TriggerMenuStatus({
  className,
  ...props
}: React.ComponentProps<typeof TriggerMenuStatusPrimitive>) {
  return (
    <TriggerMenuStatusPrimitive
      className={(state) =>
        cn("sr-only", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

export type { TriggerMenuDataItem } from "@ui-sdk/react/trigger-menu"
export { createTriggerMenuController, textFieldAdapter } from "@ui-sdk/react/trigger-menu"
export {
  TriggerMenu,
  TriggerMenuContent,
  TriggerMenuEmpty,
  TriggerMenuGroup,
  TriggerMenuGroupLabel,
  TriggerMenuHint,
  TriggerMenuInput,
  TriggerMenuItem,
  TriggerMenuItemIcon,
  TriggerMenuItems,
  TriggerMenuList,
  TriggerMenuSeparator,
  TriggerMenuStatus,
}
