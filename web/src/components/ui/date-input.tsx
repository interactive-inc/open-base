"use client"

import {
  DateInput as DateInputPrimitive,
  DateInputSegment as DateInputSegmentPrimitive,
} from "@ui-sdk/react/date-input"
import { cn } from "cn"
import type * as React from "react"

function DateInput({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DateInputPrimitive>) {
  return (
    <DateInputPrimitive
      className={(state) =>
        cn(
          "flex h-9 w-full min-w-0 items-center rounded-4xl border border-input bg-input/30 px-3 text-base tabular-nums transition-colors has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-[3px] has-aria-invalid:ring-destructive/20 data-invalid:border-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/20 data-disabled:cursor-not-allowed data-disabled:opacity-50 md:text-sm dark:has-aria-invalid:border-destructive/50 dark:data-invalid:border-destructive/50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ??
        ((state) =>
          state.segments.map((segment) => (
            <DateInputSegment key={segment.key} segment={segment} />
          )))}
    </DateInputPrimitive>
  )
}

function DateInputSegment({
  className,
  ...props
}: React.ComponentProps<typeof DateInputSegmentPrimitive>) {
  return (
    <DateInputSegmentPrimitive
      className={(state) =>
        cn(
          "field-sizing-content min-w-[2ch] rounded-sm bg-transparent px-0.5 text-center outline-none placeholder:text-muted-foreground focus:bg-primary focus:text-primary-foreground focus:placeholder:text-primary-foreground data-[type=literal]:px-0 data-[type=literal]:text-muted-foreground data-empty:text-muted-foreground disabled:cursor-not-allowed",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createDateInputController } from "@ui-sdk/react/date-input"
export { DateInput, DateInputSegment }
