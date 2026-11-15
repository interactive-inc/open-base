"use client"

import * as AlertDialogPrimitive from "@ui-sdk/react/alert-dialog"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type * as React from "react"
import { buttonVariants } from "@/components/ui/button"

function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.AlertDialog>) {
  return <AlertDialogPrimitive.AlertDialog {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.AlertDialogTrigger>) {
  return <AlertDialogPrimitive.AlertDialogTrigger {...props} />
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.AlertDialogBackdrop>) {
  return (
    <AlertDialogPrimitive.AlertDialogBackdrop
      className={(state) =>
        cn(
          "data-open:fade-in-0 data-ending-style:fade-out-0 fixed inset-0 isolate z-50 bg-black/80 duration-100 data-ending-style:animate-out data-open:animate-in supports-backdrop-filter:backdrop-blur-xs",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.AlertDialogContent> & {
  size?: "default" | "sm"
}) {
  return (
    <>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.AlertDialogContent
        data-size={size}
        className={(state) =>
          cn(
            "group/alert-dialog-content data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-6 rounded-4xl bg-popover p-6 text-popover-foreground outline-none ring-1 ring-foreground/5 duration-100 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-ending-style:animate-out data-open:animate-in data-[size=default]:sm:max-w-md",
            typeof className === "function" ? className(state) : className,
          )
        }
        {...props}
      />
    </>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-16 items-center justify-center rounded-full bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.AlertDialogTitle>) {
  return (
    <AlertDialogPrimitive.AlertDialogTitle
      className={(state) =>
        cn(
          "font-medium text-lg sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.AlertDialogDescription>) {
  return (
    <AlertDialogPrimitive.AlertDialogDescription
      className={(state) =>
        cn(
          "text-balance text-muted-foreground text-sm md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.AlertDialogClose> &
  VariantProps<typeof buttonVariants>) {
  return (
    <AlertDialogPrimitive.AlertDialogClose
      className={(state) =>
        cn(
          buttonVariants({ variant, size }),
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.AlertDialogClose> &
  VariantProps<typeof buttonVariants>) {
  return (
    <AlertDialogPrimitive.AlertDialogClose
      className={(state) =>
        cn(
          buttonVariants({ variant, size }),
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AlertDialogShortcut({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.AlertDialogShortcut>) {
  return (
    <AlertDialogPrimitive.AlertDialogShortcut
      className={(state) =>
        cn(
          "pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center rounded-sm bg-muted px-1 font-medium font-sans text-muted-foreground text-xs empty:hidden",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createAlertDialogController, createConfirm } from "@ui-sdk/react/alert-dialog"
export {
  AlertDialogShortcut,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogTrigger,
}
