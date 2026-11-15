import {
  ToolbarButton as ToolbarButtonPrimitive,
  ToolbarGroup as ToolbarGroupPrimitive,
  ToolbarInput as ToolbarInputPrimitive,
  ToolbarLink as ToolbarLinkPrimitive,
  Toolbar as ToolbarPrimitive,
  ToolbarSeparator as ToolbarSeparatorPrimitive,
} from "@ui-sdk/react/toolbar"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type * as React from "react"

import { Input as InputPrimitive } from "@ui-sdk/react/input"
import { buttonVariants } from "@/components/ui/button"

function Toolbar({ className, ...props }: React.ComponentProps<typeof ToolbarPrimitive>) {
  return (
    <ToolbarPrimitive
      className={(state) =>
        cn(
          "flex w-fit max-w-full flex-wrap items-center gap-1 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ToolbarButton({
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: React.ComponentProps<typeof ToolbarButtonPrimitive> & VariantProps<typeof buttonVariants>) {
  return (
    <ToolbarButtonPrimitive
      data-variant={variant}
      data-size={size}
      className={(state) =>
        cn(
          buttonVariants({ variant, size }),
          "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ToolbarLink({ className, ...props }: React.ComponentProps<typeof ToolbarLinkPrimitive>) {
  return (
    <ToolbarLinkPrimitive
      className={(state) =>
        cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "text-primary underline-offset-4 hover:underline data-disabled:pointer-events-none data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

/**
 * ツールバーの入力欄。SDK の Input として描くので、値の変更は onValueChange に届く
 */
function ToolbarInput({
  className,
  value,
  defaultValue,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof ToolbarInputPrimitive>, "value" | "defaultValue"> &
  Pick<React.ComponentProps<typeof InputPrimitive>, "value" | "defaultValue" | "onValueChange">) {
  return (
    <ToolbarInputPrimitive
      render={
        <InputPrimitive value={value} defaultValue={defaultValue} onValueChange={onValueChange} />
      }
      className={(state) =>
        cn(
          "h-8 w-40 min-w-0 rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ToolbarGroup({ className, ...props }: React.ComponentProps<typeof ToolbarGroupPrimitive>) {
  return (
    <ToolbarGroupPrimitive
      className={(state) =>
        cn(
          "flex items-center gap-1 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ToolbarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarSeparatorPrimitive>) {
  return (
    <ToolbarSeparatorPrimitive
      className={(state) =>
        cn(
          "shrink-0 bg-border data-[orientation=horizontal]:my-1 data-[orientation=vertical]:mx-1 data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-5 data-[orientation=horizontal]:w-auto data-[orientation=vertical]:w-px",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createToolbarController } from "@ui-sdk/react/toolbar"
export { Toolbar, ToolbarButton, ToolbarGroup, ToolbarInput, ToolbarLink, ToolbarSeparator }
