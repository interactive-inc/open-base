"use client"

import { Label as LabelPrimitive } from "@ui-sdk/react/label"
import { cn } from "cn"
import type * as React from "react"

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive>) {
  return (
    <LabelPrimitive
      className={(state) =>
        cn(
          "flex select-none items-center gap-2 font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-disabled:pointer-events-none group-data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { Label }
