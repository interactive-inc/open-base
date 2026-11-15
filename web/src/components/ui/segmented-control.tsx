"use client"

import {
  SegmentedControlIndicator as SegmentedControlIndicatorPrimitive,
  SegmentedControlItem as SegmentedControlItemPrimitive,
  SegmentedControl as SegmentedControlPrimitive,
} from "@ui-sdk/react/segmented-control"
import { cn } from "cn"
import type * as React from "react"

function SegmentedControl<T extends string = string>({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SegmentedControlPrimitive<T>>) {
  return (
    <SegmentedControlPrimitive<T>
      className={(state) =>
        cn(
          "relative isolate inline-flex w-fit items-center rounded-4xl bg-muted p-[3px] text-muted-foreground data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch data-[orientation=vertical]:rounded-2xl data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {(state) => (
        <>
          <SegmentedControlIndicator />
          {typeof children === "function" ? children(state) : children}
        </>
      )}
    </SegmentedControlPrimitive>
  )
}

function SegmentedControlIndicator({
  className,
  ...props
}: React.ComponentProps<typeof SegmentedControlIndicatorPrimitive>) {
  return (
    <SegmentedControlIndicatorPrimitive
      className={(state) =>
        cn(
          "absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) -z-10 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-4xl bg-background shadow-sm transition-[top,left,width,height] duration-200 ease-out data-[orientation=vertical]:rounded-xl motion-reduce:transition-none dark:border dark:border-input dark:bg-input/30",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function SegmentedControlItem({
  className,
  ...props
}: React.ComponentProps<typeof SegmentedControlItemPrimitive>) {
  return (
    <SegmentedControlItemPrimitive
      className={(state) =>
        cn(
          "inline-flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-4xl px-3 font-medium text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-checked:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createSegmentedControlController } from "@ui-sdk/react/segmented-control"
export { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem }
