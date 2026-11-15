import {
  ScrollAreaContent as ScrollAreaContentPrimitive,
  ScrollAreaCorner as ScrollAreaCornerPrimitive,
  ScrollArea as ScrollAreaPrimitive,
  ScrollAreaScrollbar as ScrollAreaScrollbarPrimitive,
  ScrollAreaThumb as ScrollAreaThumbPrimitive,
  ScrollAreaViewport as ScrollAreaViewportPrimitive,
} from "@ui-sdk/react/scroll-area"
import { cn } from "cn"
import type * as React from "react"

function ScrollArea({
  className,
  children,
  orientation = "vertical",
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive> & {
  orientation?: "vertical" | "horizontal" | "both"
}) {
  return (
    <ScrollAreaPrimitive
      className={(state) =>
        cn("relative", typeof className === "function" ? className(state) : className)
      }
      {...props}
    >
      <ScrollAreaViewportPrimitive
        role={ariaLabel === undefined ? undefined : "region"}
        aria-label={ariaLabel}
        className="size-full rounded-[inherit] outline-none transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ScrollAreaContentPrimitive>{children}</ScrollAreaContentPrimitive>
      </ScrollAreaViewportPrimitive>
      {orientation !== "horizontal" && <ScrollBar orientation="vertical" />}
      {orientation !== "vertical" && <ScrollBar orientation="horizontal" />}
      {orientation === "both" && <ScrollAreaCornerPrimitive />}
    </ScrollAreaPrimitive>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaScrollbarPrimitive>) {
  return (
    <ScrollAreaScrollbarPrimitive
      orientation={orientation}
      className={(state) =>
        cn(
          // 非表示のバーは SDK 側で操作を受け付けないので、見た目も data-visible に合わせる。
          "flex touch-none select-none p-px opacity-0 transition-opacity duration-150 data-visible:opacity-100 data-horizontal:h-2.5 data-vertical:w-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:border-l data-vertical:border-l-transparent",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      <ScrollAreaThumbPrimitive className="relative flex-1 rounded-full bg-border" />
    </ScrollAreaScrollbarPrimitive>
  )
}

export { createScrollAreaController } from "@ui-sdk/react/scroll-area"
export { ScrollArea, ScrollBar }
