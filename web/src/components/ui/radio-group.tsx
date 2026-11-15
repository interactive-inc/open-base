"use client"

import {
  RadioGroup as RadioGroupPrimitive,
  RadioIndicator as RadioIndicatorPrimitive,
  Radio as RadioPrimitive,
} from "@ui-sdk/react/radio"
import { cn } from "cn"
import type * as React from "react"

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive>) {
  return (
    <RadioGroupPrimitive
      className={(state) =>
        cn("grid w-full gap-3", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioPrimitive>) {
  return (
    <RadioPrimitive
      className={(state) =>
        cn(
          "group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 group-has-[:focus-visible]/field-label:not-data-checked:border-input group-has-[:focus-visible]/field-label:ring-0 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:data-checked:border-primary data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:bg-input/30 dark:data-checked:bg-primary dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      <RadioIndicatorPrimitive className="flex size-4 items-center justify-center">
        <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
      </RadioIndicatorPrimitive>
    </RadioPrimitive>
  )
}

export { createRadioGroupController } from "@ui-sdk/react/radio"
export { RadioGroup, RadioGroupItem }
