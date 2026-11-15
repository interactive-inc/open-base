import { Input as InputPrimitive } from "@ui-sdk/react/input"
import { cn } from "cn"
import type * as React from "react"

function Input({ className, ...props }: React.ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      className={(state) =>
        cn(
          "h-9 w-full min-w-0 rounded-4xl border border-input bg-input/30 px-3 py-1 text-base outline-none transition-colors file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createInputController } from "@ui-sdk/react/input"
export { Input }
