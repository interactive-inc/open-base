import {
  WaterfallAxis as WaterfallAxisPrimitive,
  WaterfallBar as WaterfallBarPrimitive,
  type WaterfallBarLabelDetails,
  WaterfallCell as WaterfallCellPrimitive,
  WaterfallColumnHeader as WaterfallColumnHeaderPrimitive,
  type WaterfallDataItem,
  WaterfallHeaderRow as WaterfallHeaderRowPrimitive,
  WaterfallIndicator as WaterfallIndicatorPrimitive,
  WaterfallMark as WaterfallMarkPrimitive,
  Waterfall as WaterfallPrimitive,
  WaterfallRowHeader as WaterfallRowHeaderPrimitive,
  WaterfallRow as WaterfallRowPrimitive,
  WaterfallTick as WaterfallTickPrimitive,
} from "@ui-sdk/react/waterfall"
import { cn } from "cn"
import { ChevronRightIcon } from "lucide-react"
import type * as React from "react"

function defaultBarLabel(_item: WaterfallDataItem, details: WaterfallBarLabelDetails) {
  return `開始 ${details.start}、所要 ${details.duration}`
}

function Waterfall({
  className,
  getBarLabel = defaultBarLabel,
  ...props
}: React.ComponentProps<typeof WaterfallPrimitive>) {
  return (
    <WaterfallPrimitive
      getBarLabel={getBarLabel}
      className={(state) =>
        cn(
          "flex w-full flex-col text-sm [--waterfall-columns:minmax(8rem,12rem)_minmax(0,1fr)]",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function WaterfallHeaderRow({
  className,
  ...props
}: React.ComponentProps<typeof WaterfallHeaderRowPrimitive>) {
  return (
    <WaterfallHeaderRowPrimitive
      className={(state) =>
        cn(
          "grid grid-cols-(--waterfall-columns) items-end border-border border-b text-muted-foreground text-xs",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function WaterfallColumnHeader({
  className,
  ...props
}: React.ComponentProps<typeof WaterfallColumnHeaderPrimitive>) {
  return (
    <WaterfallColumnHeaderPrimitive
      className={(state) =>
        cn(
          "relative px-2 py-1.5 text-left font-medium",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function WaterfallAxis({
  className,
  children,
  ...props
}: React.ComponentProps<typeof WaterfallAxisPrimitive>) {
  return (
    <WaterfallAxisPrimitive
      className={(state) =>
        cn("relative h-4", typeof className === "function" ? className(state) : className)
      }
      {...props}
    >
      {children ??
        ((state) => state.ticks.map((tick) => <WaterfallTick key={tick.time} time={tick.time} />))}
    </WaterfallAxisPrimitive>
  )
}

function WaterfallTick({
  className,
  ...props
}: React.ComponentProps<typeof WaterfallTickPrimitive>) {
  return (
    <WaterfallTickPrimitive
      className={(state) =>
        cn(
          "absolute start-(--waterfall-tick) whitespace-nowrap font-normal tabular-nums ltr:-translate-x-1/2 rtl:translate-x-1/2 first:translate-x-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function WaterfallMark({
  className,
  ...props
}: React.ComponentProps<typeof WaterfallMarkPrimitive>) {
  return (
    <WaterfallMarkPrimitive
      className={(state) =>
        cn(
          "absolute start-(--waterfall-mark) top-0 whitespace-nowrap border-destructive border-s border-dashed ps-1 text-destructive data-outside:hidden",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function WaterfallRow({ className, ...props }: React.ComponentProps<typeof WaterfallRowPrimitive>) {
  return (
    <WaterfallRowPrimitive
      className={(state) =>
        cn(
          "grid grid-cols-(--waterfall-columns) items-center rounded-xl outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-selected:bg-muted",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function WaterfallRowHeader({
  className,
  ...props
}: React.ComponentProps<typeof WaterfallRowHeaderPrimitive>) {
  return (
    <WaterfallRowHeaderPrimitive
      className={(state) =>
        cn(
          "flex min-w-0 items-center gap-1 truncate rounded-xl py-1.5 pr-2 ps-[calc((var(--waterfall-level,1)-1)*1rem+0.5rem)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-selected:font-medium",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function WaterfallIndicator({
  className,
  children,
  ...props
}: React.ComponentProps<typeof WaterfallIndicatorPrimitive>) {
  return (
    <WaterfallIndicatorPrimitive
      className={(state) =>
        cn(
          "flex size-4 shrink-0 items-center justify-center text-muted-foreground transition-transform data-expanded:rotate-90 motion-reduce:transition-none rtl:-scale-x-100 [&_svg]:size-4",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <ChevronRightIcon aria-hidden="true" />}
    </WaterfallIndicatorPrimitive>
  )
}

function WaterfallCell({
  className,
  ...props
}: React.ComponentProps<typeof WaterfallCellPrimitive>) {
  return (
    <WaterfallCellPrimitive
      className={(state) =>
        cn(
          "truncate rounded-xl px-2 py-1.5 text-muted-foreground tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function WaterfallBar({ className, ...props }: React.ComponentProps<typeof WaterfallBarPrimitive>) {
  return (
    <WaterfallBarPrimitive
      className={(state) =>
        cn(
          "relative h-8 rounded-xl outline-none before:absolute before:inset-y-2.5 before:start-(--waterfall-start) before:w-(--waterfall-size) before:min-w-1 before:rounded-full before:bg-primary/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-selected:before:bg-primary",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export type { WaterfallData } from "@ui-sdk/react/waterfall"
export { createWaterfallController, visibleWaterfallRows } from "@ui-sdk/react/waterfall"
export {
  Waterfall,
  WaterfallAxis,
  WaterfallBar,
  WaterfallCell,
  WaterfallColumnHeader,
  WaterfallHeaderRow,
  WaterfallIndicator,
  WaterfallMark,
  WaterfallRow,
  WaterfallRowHeader,
  WaterfallTick,
}
