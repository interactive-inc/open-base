"use client"

import { type RenderProp, renderElement } from "@ui-sdk/react/primitive"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type * as React from "react"

import { Separator } from "@/components/ui/separator"

const buttonGroupVariants = cva(
  "flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 has-[>[data-slot=button-group]]:gap-2 [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-4xl",
  {
    variants: {
      orientation: {
        horizontal:
          "*:data-slot:rounded-r-none [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0 [&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-4xl!",
        vertical:
          "flex-col *:data-slot:rounded-b-none [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0 [&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-4xl!",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  },
)

function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  )
}

function ButtonGroupText({
  className,
  render,
  ...props
}: React.ComponentProps<"div"> & { render?: RenderProp }) {
  return renderElement(
    "div",
    {
      "data-slot": "button-group-text",
      className: cn(
        "flex items-center gap-2 border bg-muted px-2.5 text-sm font-medium [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 rounded-4xl",
        className,
      ),
      ...props,
    },
    render,
  )
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      orientation={orientation}
      className={(state) =>
        cn(
          "relative self-stretch bg-input data-horizontal:mx-px data-vertical:my-px data-vertical:h-auto data-horizontal:w-auto",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants }
