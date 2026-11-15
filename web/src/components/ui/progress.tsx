import {
  ProgressIndicator as ProgressIndicatorPrimitive,
  ProgressLabel as ProgressLabelPrimitive,
  Progress as ProgressPrimitive,
  ProgressTrack as ProgressTrackPrimitive,
  ProgressValue as ProgressValuePrimitive,
} from "@ui-sdk/react/progress"
import { cn } from "cn"
import type * as React from "react"

function Progress({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive>) {
  return (
    <ProgressPrimitive
      value={value}
      className={(state) =>
        cn("flex flex-wrap gap-3", typeof className === "function" ? className(state) : className)
      }
      {...props}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children(state) : children}
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </>
      )}
    </ProgressPrimitive>
  )
}

function ProgressTrack({
  className,
  ...props
}: React.ComponentProps<typeof ProgressTrackPrimitive>) {
  return (
    <ProgressTrackPrimitive
      className={(state) =>
        cn(
          "relative flex h-3 w-full items-center overflow-x-hidden rounded-4xl bg-muted",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ProgressIndicator({
  className,
  ...props
}: React.ComponentProps<typeof ProgressIndicatorPrimitive>) {
  return (
    <ProgressIndicatorPrimitive
      className={(state) =>
        cn(
          "h-full bg-primary transition-all",
          "data-indeterminate:ml-auto data-indeterminate:w-1/3 data-indeterminate:rounded-4xl data-indeterminate:animate-in data-indeterminate:slide-in-from-left-[200%] data-indeterminate:repeat-infinite data-indeterminate:direction-alternate data-indeterminate:duration-1000 data-indeterminate:ease-in-out data-indeterminate:transition-none motion-reduce:data-indeterminate:w-full motion-reduce:data-indeterminate:animate-none",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ProgressLabel({
  className,
  ...props
}: React.ComponentProps<typeof ProgressLabelPrimitive>) {
  return (
    <ProgressLabelPrimitive
      className={(state) =>
        cn("font-medium text-sm", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function ProgressValue({
  className,
  ...props
}: React.ComponentProps<typeof ProgressValuePrimitive>) {
  return (
    <ProgressValuePrimitive
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

export { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue }
