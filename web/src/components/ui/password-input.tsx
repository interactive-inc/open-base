"use client"

import {
  PasswordInputControl as PasswordInputControlPrimitive,
  PasswordInput as PasswordInputPrimitive,
  PasswordInputToggle as PasswordInputTogglePrimitive,
} from "@ui-sdk/react/password-input"
import { cn } from "cn"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import type * as React from "react"

function PasswordInput({
  className,
  ...props
}: React.ComponentProps<typeof PasswordInputPrimitive>) {
  return (
    <PasswordInputPrimitive
      className={(state) =>
        cn(
          "group/password-input relative flex h-9 w-full min-w-0 items-center rounded-4xl border border-input bg-input/30 transition-colors has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-[3px] has-aria-invalid:ring-destructive/20 data-disabled:cursor-not-allowed data-disabled:opacity-50 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function PasswordInputControl({
  className,
  ...props
}: React.ComponentProps<typeof PasswordInputControlPrimitive>) {
  return (
    <PasswordInputControlPrimitive
      className={(state) =>
        cn(
          "h-full w-full min-w-0 flex-1 bg-transparent py-1 ps-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function PasswordInputToggle({
  className,
  children,
  "aria-label": ariaLabel = "パスワードを表示",
  ...props
}: React.ComponentProps<typeof PasswordInputTogglePrimitive>) {
  return (
    <PasswordInputTogglePrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          "me-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {(state) =>
        typeof children === "function"
          ? children(state)
          : (children ??
            (state.visible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />))
      }
    </PasswordInputTogglePrimitive>
  )
}

export { createPasswordInputController } from "@ui-sdk/react/password-input"
export { PasswordInput, PasswordInputControl, PasswordInputToggle }
