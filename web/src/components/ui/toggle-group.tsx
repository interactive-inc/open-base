import {
  ToggleGroup as ToggleGroupPrimitive,
  Toggle as TogglePrimitive,
} from "@ui-sdk/react/toggle"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import * as React from "react"

import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
  }
>({
  size: "default",
  variant: "default",
  spacing: 2,
  orientation: "horizontal",
})

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 2,
  orientation = "horizontal",
  style,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive> &
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
  }) {
  return (
    <ToggleGroupContext.Provider value={{ variant, size, spacing, orientation }}>
      <ToggleGroupPrimitive
        data-variant={variant ?? undefined}
        data-size={size ?? undefined}
        data-spacing={spacing}
        orientation={orientation}
        style={(state) =>
          ({
            "--gap": spacing,
            ...(typeof style === "function" ? style(state) : style),
          }) as React.CSSProperties
        }
        className={(state) =>
          cn(
            "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-[spacing=0]:data-[variant=outline]:rounded-4xl data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
            typeof className === "function" ? className(state) : className,
          )
        }
        {...props}
      />
    </ToggleGroupContext.Provider>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive> & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)
  const itemVariant = variant ?? context.variant ?? "default"
  const itemSize = size ?? context.size ?? "default"

  return (
    <TogglePrimitive
      data-variant={itemVariant}
      data-size={itemSize}
      data-spacing={context.spacing}
      className={(state) =>
        cn(
          "shrink-0 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:rounded-none group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-[spacing=0]/toggle-group:px-3 group-data-[spacing=0]/toggle-group:shadow-none data-pressed:bg-muted group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-2.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-2.5 group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:last:rounded-r-3xl group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:last:rounded-b-3xl group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:first:rounded-t-3xl group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:first:rounded-l-3xl",
          toggleVariants({ variant: itemVariant, size: itemSize }),
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { createToggleGroupController } from "@ui-sdk/react/toggle"
export { ToggleGroup, ToggleGroupItem }
