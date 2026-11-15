import {
  OTPInputGroup as OTPInputGroupPrimitive,
  OTPInput as OTPInputPrimitive,
  OTPInputSeparator as OTPInputSeparatorPrimitive,
  OTPInputSlot as OTPInputSlotPrimitive,
} from "@ui-sdk/react/otp-input"
import { cn } from "cn"
import { MinusIcon } from "lucide-react"
import type * as React from "react"

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInputPrimitive> & {
  containerClassName?: string
}) {
  return (
    <OTPInputPrimitive
      className={(state) =>
        cn(
          "group/input-otp flex items-center data-disabled:opacity-50 [&_input:disabled]:cursor-not-allowed",
          containerClassName,
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function InputOTPGroup({
  className,
  ...props
}: React.ComponentProps<typeof OTPInputGroupPrimitive>) {
  return (
    <OTPInputGroupPrimitive
      className={(state) =>
        cn(
          "flex items-center rounded-4xl group-has-aria-invalid/input-otp:ring-[3px] group-has-aria-invalid/input-otp:ring-destructive/20 dark:group-has-aria-invalid/input-otp:ring-destructive/40",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  className,
  children,
  ...props
}: React.ComponentProps<typeof OTPInputSlotPrimitive>) {
  return (
    <OTPInputSlotPrimitive
      index={index}
      className={(state) =>
        cn(
          "relative flex size-9 items-center justify-center border-input border-y border-r bg-input/30 text-sm outline-none transition-all first:rounded-l-4xl first:border-l last:rounded-r-4xl group-has-aria-invalid/input-otp:border-destructive data-active:z-10 data-active:border-ring data-active:ring-3 data-active:ring-ring/50 group-has-aria-invalid/input-otp:data-active:border-destructive group-has-aria-invalid/input-otp:data-active:ring-destructive/20 dark:group-has-aria-invalid/input-otp:data-active:ring-destructive/40",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children(state) : (children ?? state.char)}
          {state.hasFakeCaret && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-4 w-px animate-caret-blink bg-foreground" />
            </div>
          )}
        </>
      )}
    </OTPInputSlotPrimitive>
  )
}

function InputOTPSeparator({
  className,
  children,
  ...props
}: React.ComponentProps<typeof OTPInputSeparatorPrimitive>) {
  return (
    <OTPInputSeparatorPrimitive
      className={(state) =>
        cn(
          "flex items-center [&_svg:not([class*='size-'])]:size-4",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <MinusIcon />}
    </OTPInputSeparatorPrimitive>
  )
}

export { createOTPInputController } from "@ui-sdk/react/otp-input"
export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot }
