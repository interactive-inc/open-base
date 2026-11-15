import { Toggle as TogglePrimitive } from "@ui-sdk/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type * as React from "react"

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 text-sm font-medium whitespace-nowrap outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-pressed:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 rounded-4xl transition-colors",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-muted",
      },
      size: {
        default:
          "h-9 min-w-9 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        sm: "h-8 min-w-8 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-10 min-w-10 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      className={(state) =>
        cn(
          toggleVariants({ variant, size }),
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createToggleController } from "@ui-sdk/react/toggle"
export { Toggle, toggleVariants }
