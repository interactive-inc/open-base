import {
  NumberInputControl as NumberInputControlPrimitive,
  NumberInputDecrement as NumberInputDecrementPrimitive,
  NumberInputGroup as NumberInputGroupPrimitive,
  NumberInputIncrement as NumberInputIncrementPrimitive,
  NumberInput as NumberInputPrimitive,
  NumberInputScrubAreaCursor as NumberInputScrubAreaCursorPrimitive,
  NumberInputScrubArea as NumberInputScrubAreaPrimitive,
} from "@ui-sdk/react/number-input"
import { cn } from "cn"
import { MinusIcon, PlusIcon } from "lucide-react"
import type * as React from "react"

const stepButtonClassName =
  "inline-flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground outline-none transition-colors hover:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"

function NumberInput({ className, ...props }: React.ComponentProps<typeof NumberInputPrimitive>) {
  return (
    <NumberInputPrimitive
      className={(state) =>
        cn(
          "flex w-full flex-col gap-2",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function NumberInputGroup({
  className,
  ...props
}: React.ComponentProps<typeof NumberInputGroupPrimitive>) {
  return (
    <NumberInputGroupPrimitive
      className={(state) =>
        cn(
          "flex h-9 w-full min-w-0 items-center overflow-hidden rounded-4xl border border-input bg-input/30 transition-colors has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-[3px] has-aria-invalid:ring-destructive/20 data-disabled:cursor-not-allowed data-disabled:opacity-50 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function NumberInputControl({
  className,
  ...props
}: React.ComponentProps<typeof NumberInputControlPrimitive>) {
  return (
    <NumberInputControlPrimitive
      className={(state) =>
        cn(
          "h-full w-full min-w-0 flex-1 bg-transparent px-1 text-center text-base tabular-nums outline-none placeholder:text-muted-foreground first:ps-3 last:pe-3 disabled:cursor-not-allowed md:text-sm",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function NumberInputDecrement({
  className,
  children,
  "aria-label": ariaLabel = "減らす",
  ...props
}: React.ComponentProps<typeof NumberInputDecrementPrimitive>) {
  return (
    <NumberInputDecrementPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(stepButtonClassName, typeof className === "function" ? className(state) : className)
      }
      {...props}
    >
      {children ?? <MinusIcon aria-hidden="true" />}
    </NumberInputDecrementPrimitive>
  )
}

function NumberInputIncrement({
  className,
  children,
  "aria-label": ariaLabel = "増やす",
  ...props
}: React.ComponentProps<typeof NumberInputIncrementPrimitive>) {
  return (
    <NumberInputIncrementPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(stepButtonClassName, typeof className === "function" ? className(state) : className)
      }
      {...props}
    >
      {children ?? <PlusIcon aria-hidden="true" />}
    </NumberInputIncrementPrimitive>
  )
}

function NumberInputScrubArea({
  className,
  ...props
}: React.ComponentProps<typeof NumberInputScrubAreaPrimitive>) {
  return (
    <NumberInputScrubAreaPrimitive
      className={(state) =>
        cn(
          "inline-flex w-fit cursor-ew-resize touch-none select-none items-center gap-1.5 font-medium text-sm data-[orientation=vertical]:cursor-ns-resize data-disabled:cursor-not-allowed data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function NumberInputScrubAreaCursor({
  className,
  ...props
}: React.ComponentProps<typeof NumberInputScrubAreaCursorPrimitive>) {
  return (
    <NumberInputScrubAreaCursorPrimitive
      className={(state) =>
        cn(
          "pointer-events-none text-foreground drop-shadow-sm",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createNumberInputController } from "@ui-sdk/react/number-input"
export {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
  NumberInputScrubArea,
  NumberInputScrubAreaCursor,
}
