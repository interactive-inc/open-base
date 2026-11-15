"use client"

import { Textarea as TextareaPrimitive } from "@ui-sdk/react/textarea"
import { cn } from "cn"
import type * as React from "react"

function Textarea({ className, ...props }: React.ComponentProps<typeof TextareaPrimitive>) {
  return (
    <TextareaPrimitive
      className={(state) =>
        cn(
          "field-sizing-content flex min-h-16 w-full resize-none rounded-xl border border-input bg-input/30 px-3 py-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createInputController } from "@ui-sdk/react/textarea"
export { Textarea }
