"use client"

import {
  NavigationMenuContent as NavigationMenuContentPrimitive,
  NavigationMenuIndicator as NavigationMenuIndicatorPrimitive,
  NavigationMenuItem as NavigationMenuItemPrimitive,
  NavigationMenuLink as NavigationMenuLinkPrimitive,
  NavigationMenuList as NavigationMenuListPrimitive,
  NavigationMenu as NavigationMenuPrimitive,
  NavigationMenuTrigger as NavigationMenuTriggerPrimitive,
  NavigationMenuViewport as NavigationMenuViewportPrimitive,
} from "@ui-sdk/react/navigation-menu"
import { cva } from "class-variance-authority"
import { cn } from "cn"
import { ChevronDownIcon } from "lucide-react"
import type * as React from "react"

function NavigationMenu({
  align = "start",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof NavigationMenuPrimitive>, "children"> &
  Pick<React.ComponentProps<typeof NavigationMenuViewportPrimitive>, "align"> & {
    children?: React.ReactNode
  }) {
  return (
    <NavigationMenuPrimitive
      className={(state) =>
        cn(
          "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children}
      <NavigationMenuViewport align={align} />
    </NavigationMenuPrimitive>
  )
}

function NavigationMenuList({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuListPrimitive>) {
  return (
    <NavigationMenuListPrimitive
      className={(state) =>
        cn(
          "group flex flex-1 list-none items-center justify-center gap-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function NavigationMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuItemPrimitive>) {
  return (
    <NavigationMenuItemPrimitive
      className={(state) =>
        cn("relative", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

const navigationMenuTriggerStyle = cva(
  "group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center text-sm font-medium transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-open:bg-muted/50 data-open:hover:bg-muted data-open:focus:bg-muted rounded-2xl px-4.5 py-2.5 focus-visible:ring-[3px]",
)

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof NavigationMenuTriggerPrimitive>, "children"> & {
  children?: React.ReactNode
}) {
  return (
    <NavigationMenuTriggerPrimitive
      className={(state) =>
        cn(
          navigationMenuTriggerStyle(),
          "group",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children}{" "}
      <ChevronDownIcon
        className="relative top-px ml-1 size-3 transition duration-300 group-data-open/navigation-menu-trigger:rotate-180"
        aria-hidden="true"
      />
    </NavigationMenuTriggerPrimitive>
  )
}

function NavigationMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuContentPrimitive>) {
  return (
    <NavigationMenuContentPrimitive
      className={(state) =>
        cn(
          "data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out absolute start-0 top-0 isolate z-50 w-max p-2.5 pr-3 transition-[opacity,transform,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-ending-style:opacity-0 data-starting-style:opacity-0 **:data-[slot=navigation-menu-link]:focus:outline-none **:data-[slot=navigation-menu-link]:focus:ring-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function NavigationMenuViewport({
  className,
  side = "bottom",
  sideOffset = 8,
  align = "start",
  alignOffset = 0,
  ...props
}: React.ComponentProps<typeof NavigationMenuViewportPrimitive>) {
  return (
    <NavigationMenuViewportPrimitive
      side={side}
      sideOffset={sideOffset}
      align={align}
      alignOffset={alignOffset}
      className={(state) =>
        cn(
          "data-ending-style:ease-[ease] isolate z-50 h-(--viewport-height) w-(--viewport-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow outline-none ring-1 ring-foreground/5 transition-[opacity,transform,width,height,scale,translate,top,left] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:scale-90 data-starting-style:scale-90 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-150",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function NavigationMenuLink({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuLinkPrimitive>) {
  return (
    <NavigationMenuLinkPrimitive
      className={(state) =>
        cn(
          "flex items-center gap-1.5 in-data-[slot=navigation-menu-content]:rounded-xl rounded-2xl p-3 text-sm outline-none transition-all hover:bg-muted focus:bg-muted focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-current:bg-muted/50 data-current:focus:bg-muted data-current:hover:bg-muted [&_svg:not([class*='size-'])]:size-4",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function NavigationMenuIndicator({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuIndicatorPrimitive>) {
  return (
    <NavigationMenuIndicatorPrimitive
      className={(state) =>
        cn(
          "data-open:fade-in absolute top-[calc(var(--active-item-top)+var(--active-item-height))] left-(--active-item-left) z-1 flex h-2 w-(--active-item-width) items-end justify-center overflow-hidden opacity-0 data-open:animate-in data-open:opacity-100",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
    </NavigationMenuIndicatorPrimitive>
  )
}

export { createNavigationMenuController } from "@ui-sdk/react/navigation-menu"
export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
}
