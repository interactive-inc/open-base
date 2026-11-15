"use client"

import {
  CheckboxGroup as CheckboxGroupPrimitive,
  CheckboxIndicator as CheckboxIndicatorPrimitive,
  Checkbox as CheckboxPrimitive,
} from "@ui-sdk/react/checkbox"
import { cn } from "cn"
import { CheckIcon, MinusIcon } from "lucide-react"
import type * as React from "react"

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive>) {
  return (
    <CheckboxPrimitive
      className={(state) =>
        cn(
          "peer relative flex size-4 shrink-0 items-center justify-center rounded-[6px] border border-input outline-none transition-shadow after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 group-has-[:focus-visible]/field-label:not-data-checked:not-data-indeterminate:border-input group-has-[:focus-visible]/field-label:ring-0 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:data-checked:border-primary aria-invalid:data-indeterminate:border-primary data-checked:border-primary data-indeterminate:border-primary data-checked:bg-primary data-indeterminate:bg-primary data-checked:text-primary-foreground data-indeterminate:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary group-has-[:focus-visible]/field-label:data-indeterminate:border-primary dark:bg-input/30 dark:data-checked:bg-primary dark:data-indeterminate:bg-primary dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      <CheckboxIndicatorPrimitive className="grid place-content-center text-current transition-none [&>svg]:size-3.5">
        {(state) => (state.indeterminate ? <MinusIcon /> : <CheckIcon />)}
      </CheckboxIndicatorPrimitive>
    </CheckboxPrimitive>
  )
}

function CheckboxGroup<T extends string = string>({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxGroupPrimitive<T>>) {
  return (
    <CheckboxGroupPrimitive
      className={(state) =>
        cn("flex flex-col gap-3", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

export type { CheckedState } from "@ui-sdk/react/checkbox"
export { createCheckboxController, createCheckboxGroupController } from "@ui-sdk/react/checkbox"
export { Checkbox, CheckboxGroup }
