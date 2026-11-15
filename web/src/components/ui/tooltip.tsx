"use client"

import * as TooltipPrimitive from "@ui-sdk/react/tooltip"
import { cn } from "cn"
import type * as React from "react"

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Tooltip>) {
  return <TooltipPrimitive.Tooltip {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.TooltipTrigger>) {
  return <TooltipPrimitive.TooltipTrigger {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.TooltipContent>) {
  return (
    <TooltipPrimitive.TooltipContent
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className={(state) =>
        cn(
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-2xl bg-foreground px-3 py-1.5 text-background text-xs has-data-[slot=kbd]:pr-1.5 has-data-[slot=tooltip-shortcut]:pr-1.5 data-ending-style:animate-out data-open:animate-in **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-4xl",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children(state) : children}
          <TooltipPrimitive.TooltipArrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=left]:top-1/2! data-[side=right]:top-1/2! data-[side=left]:-right-1 data-[side=top]:-bottom-2.5 data-[side=right]:-left-1 data-[side=inline-end]:translate-x-[1.5px] data-[side=inline-start]:translate-x-[-1.5px] data-[side=left]:translate-x-[-1.5px] data-[side=right]:translate-x-[1.5px] data-[side=left]:-translate-y-1/2 data-[side=right]:-translate-y-1/2" />
        </>
      )}
    </TooltipPrimitive.TooltipContent>
  )
}

function TooltipShortcut({
  className,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.TooltipShortcut>) {
  return (
    <TooltipPrimitive.TooltipShortcut
      className={(state) =>
        cn(
          "pointer-events-none relative isolate z-50 inline-flex h-5 w-fit min-w-5 select-none items-center justify-center rounded-4xl bg-background/20 px-1.5 font-medium font-sans text-background text-xs empty:hidden dark:bg-background/10",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createTooltipController } from "@ui-sdk/react/tooltip"
export { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger }
