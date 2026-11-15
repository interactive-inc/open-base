"use client"

import {
  TimelineConnector as TimelineConnectorPrimitive,
  TimelineDescription as TimelineDescriptionPrimitive,
  TimelineItem as TimelineItemPrimitive,
  TimelineMarker as TimelineMarkerPrimitive,
  Timeline as TimelinePrimitive,
  TimelineTime as TimelineTimePrimitive,
  TimelineTitle as TimelineTitlePrimitive,
} from "@ui-sdk/react/timeline"
import { cn } from "cn"
import type * as React from "react"

function Timeline({ className, ...props }: React.ComponentProps<typeof TimelinePrimitive>) {
  return (
    <TimelinePrimitive
      className={(state) =>
        cn(
          "flex w-full flex-col data-[orientation=horizontal]:flex-row",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TimelineItem({ className, ...props }: React.ComponentProps<typeof TimelineItemPrimitive>) {
  return (
    <TimelineItemPrimitive
      className={(state) =>
        cn(
          "group/timeline-item relative grid grid-cols-[1rem_minmax(0,1fr)] content-start gap-x-3 gap-y-0.5 rounded-xl pb-6 outline-none last:pb-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[orientation=horizontal]:flex-1 data-[orientation=horizontal]:grid-cols-1 data-[orientation=horizontal]:gap-y-1 data-[orientation=horizontal]:pr-4 data-[orientation=horizontal]:pb-0 data-[orientation=horizontal]:last:pr-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TimelineMarker({
  className,
  ...props
}: React.ComponentProps<typeof TimelineMarkerPrimitive>) {
  return (
    <TimelineMarkerPrimitive
      className={(state) =>
        cn(
          "relative z-10 col-start-1 row-start-1 mt-0.5 flex size-4 items-center justify-center rounded-full border-2 border-primary bg-background text-primary-foreground data-complete:bg-primary data-upcoming:border-input [&_svg:not([class*='size-'])]:size-2.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TimelineConnector({
  className,
  ...props
}: React.ComponentProps<typeof TimelineConnectorPrimitive>) {
  return (
    <TimelineConnectorPrimitive
      className={(state) =>
        cn(
          "absolute top-5 bottom-0 left-[calc(0.5rem-1px)] w-0.5 bg-border group-last/timeline-item:hidden data-complete:bg-primary data-[orientation=horizontal]:top-[calc(0.625rem-1px)] data-[orientation=horizontal]:right-0 data-[orientation=horizontal]:bottom-auto data-[orientation=horizontal]:left-5 data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:w-auto",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TimelineTitle({
  className,
  ...props
}: React.ComponentProps<typeof TimelineTitlePrimitive>) {
  return (
    <TimelineTitlePrimitive
      className={(state) =>
        cn(
          "col-start-2 font-medium text-sm leading-5 data-upcoming:text-muted-foreground data-[orientation=horizontal]:col-start-1",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TimelineTime({ className, ...props }: React.ComponentProps<typeof TimelineTimePrimitive>) {
  return (
    <TimelineTimePrimitive
      className={(state) =>
        cn(
          "col-start-2 text-muted-foreground text-xs tabular-nums data-[orientation=horizontal]:col-start-1",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TimelineDescription({
  className,
  ...props
}: React.ComponentProps<typeof TimelineDescriptionPrimitive>) {
  return (
    <TimelineDescriptionPrimitive
      className={(state) =>
        cn(
          "col-start-2 text-muted-foreground text-sm data-[orientation=horizontal]:col-start-1",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createTimelineController } from "@ui-sdk/react/timeline"
export {
  Timeline,
  TimelineConnector,
  TimelineDescription,
  TimelineItem,
  TimelineMarker,
  TimelineTime,
  TimelineTitle,
}
