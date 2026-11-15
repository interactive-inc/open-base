"use client"

import { Separator as SeparatorPrimitive } from "@ui-sdk/react/separator"
import { cn } from "cn"
import type * as React from "react"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive>) {
  return (
    <SeparatorPrimitive
      orientation={orientation}
      className={(state) =>
        cn(
          "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { Separator }
