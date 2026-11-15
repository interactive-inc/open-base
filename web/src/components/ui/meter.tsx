import {
  MeterIndicator as MeterIndicatorPrimitive,
  MeterLabel as MeterLabelPrimitive,
  Meter as MeterPrimitive,
  MeterTrack as MeterTrackPrimitive,
  MeterValue as MeterValuePrimitive,
} from "@ui-sdk/react/meter"
import { cn } from "cn"
import type * as React from "react"

function Meter({ className, children, ...props }: React.ComponentProps<typeof MeterPrimitive>) {
  return (
    <MeterPrimitive
      className={(state) =>
        cn(
          "flex w-full flex-wrap gap-x-3 gap-y-2",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children(state) : children}
          <MeterTrack>
            <MeterIndicator />
          </MeterTrack>
        </>
      )}
    </MeterPrimitive>
  )
}

function MeterTrack({ className, ...props }: React.ComponentProps<typeof MeterTrackPrimitive>) {
  return (
    <MeterTrackPrimitive
      className={(state) =>
        cn(
          "relative flex h-3 w-full items-center overflow-hidden rounded-4xl bg-muted",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function MeterIndicator({
  className,
  ...props
}: React.ComponentProps<typeof MeterIndicatorPrimitive>) {
  return (
    <MeterIndicatorPrimitive
      className={(state) =>
        cn(
          "h-full rounded-4xl bg-primary transition-[width] motion-reduce:transition-none",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function MeterLabel({ className, ...props }: React.ComponentProps<typeof MeterLabelPrimitive>) {
  return (
    <MeterLabelPrimitive
      className={(state) =>
        cn("font-medium text-sm", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function MeterValue({ className, ...props }: React.ComponentProps<typeof MeterValuePrimitive>) {
  return (
    <MeterValuePrimitive
      className={(state) =>
        cn(
          "ml-auto text-muted-foreground text-sm tabular-nums",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { Meter, MeterIndicator, MeterLabel, MeterTrack, MeterValue }
