import * as HoverCardPrimitive from "@ui-sdk/react/hover-card"
import { cn } from "cn"
import type * as React from "react"

function HoverCard({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.HoverCard>) {
  return <HoverCardPrimitive.HoverCard {...props} />
}

function HoverCardTrigger({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.HoverCardTrigger>) {
  return <HoverCardPrimitive.HoverCardTrigger {...props} />
}

function HoverCardContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.HoverCardContent>) {
  return (
    <HoverCardPrimitive.HoverCardContent
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className={(state) =>
        cn(
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 z-50 w-72 origin-(--transform-origin) rounded-2xl bg-popover p-4 text-popover-foreground text-sm shadow-2xl outline-hidden ring-1 ring-foreground/5 duration-100 data-ending-style:animate-out data-open:animate-in",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createHoverCardController } from "@ui-sdk/react/hover-card"
export { HoverCard, HoverCardContent, HoverCardTrigger }
