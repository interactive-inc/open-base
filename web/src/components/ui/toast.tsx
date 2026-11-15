"use client"

import {
  createToaster,
  ToastAction as ToastActionPrimitive,
  ToastClose as ToastClosePrimitive,
  ToastDescription as ToastDescriptionPrimitive,
  Toast as ToastPrimitive,
  ToastRegion as ToastRegionPrimitive,
  ToastTitle as ToastTitlePrimitive,
  toast,
} from "@ui-sdk/react/toast"
import { cn } from "cn"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import type * as React from "react"

import { buttonVariants } from "@/components/ui/button"

function ToastViewport({ className, ...props }: React.ComponentProps<typeof ToastRegionPrimitive>) {
  return (
    <ToastRegionPrimitive
      aria-label="通知"
      data-agent-hidden=""
      className={(state) =>
        cn(
          "pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-sm outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function Toast({ className, ...props }: React.ComponentProps<typeof ToastPrimitive>) {
  return (
    <ToastPrimitive
      className={(state) =>
        cn(
          "group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom select-none rounded-2xl border bg-popover text-popover-foreground shadow-lg outline-none will-change-transform focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "[--gap:0.75rem] [--height:var(--toast-front-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-y,0px))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
          "h-(--height) [transform:translateX(var(--toast-swipe-x,0px))_translateY(calc(var(--toast-swipe-y,0px)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]",
          "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
          "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-x,0px))_translateY(var(--offset-y))]",
          "data-swiping:[transition:none]",
          "data-ending-style:opacity-0 data-starting-style:[transform:translateY(150%)]",
          "[&[data-ending-style]:not([data-swipe-direction])]:[transform:translateY(150%)]",
          "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-y,0px)+150%))]",
          "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-x,0px)-150%))_translateY(var(--offset-y))]",
          "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-x,0px)+150%))_translateY(var(--offset-y))]",
          "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-y,0px)-150%))]",
          "data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-y,0px)+150%))]",
          "data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-x,0px)-150%))_translateY(var(--offset-y))]",
          "data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-x,0px)+150%))_translateY(var(--offset-y))]",
          "data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-y,0px)-150%))]",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ToastContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="toast-content"
      className={cn(
        "flex h-full items-center gap-3 overflow-hidden p-4 opacity-0 transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-expanded/toast:opacity-100 group-data-front/toast:opacity-100",
        className,
      )}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: React.ComponentProps<typeof ToastTitlePrimitive>) {
  return (
    <ToastTitlePrimitive
      className={(state) =>
        cn("font-medium text-sm", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: React.ComponentProps<typeof ToastDescriptionPrimitive>) {
  return (
    <ToastDescriptionPrimitive
      className={(state) =>
        cn(
          "text-muted-foreground text-sm",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ToastAction({ className, ...props }: React.ComponentProps<typeof ToastActionPrimitive>) {
  return (
    <ToastActionPrimitive
      className={(state) =>
        cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ToastClose({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ToastClosePrimitive>) {
  return (
    <ToastClosePrimitive
      aria-label="通知を閉じる"
      className={(state) =>
        cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "relative shrink-0 text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:text-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <XIcon aria-hidden="true" />}
    </ToastClosePrimitive>
  )
}

function ToastIcon({ type }: { type: string | undefined }) {
  let icon: React.ReactNode = null

  if (type === "success") {
    icon = <CircleCheckIcon aria-hidden="true" />
  }

  if (type === "info") {
    icon = <InfoIcon aria-hidden="true" />
  }

  if (type === "warning") {
    icon = <TriangleAlertIcon aria-hidden="true" />
  }

  if (type === "error") {
    icon = <OctagonXIcon className="text-destructive" aria-hidden="true" />
  }

  if (type === "loading") {
    icon = <Loader2Icon className="animate-spin" aria-hidden="true" />
  }

  if (!icon) {
    return null
  }

  return (
    <span
      data-slot="toast-icon"
      className="shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none"
    >
      {icon}
    </span>
  )
}

function Toaster({
  children,
  toaster = toast,
  ...props
}: Omit<React.ComponentProps<typeof ToastViewport>, "children"> & {
  children?: React.ReactNode
}) {
  return (
    <>
      {children}
      <ToastViewport toaster={toaster} {...props}>
        {(toastItem) => (
          <Toast>
            <ToastContent>
              <ToastIcon type={toastItem.type} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <ToastTitle />
                <ToastDescription />
              </div>
              <ToastAction />
              <ToastClose />
            </ToastContent>
          </Toast>
        )}
      </ToastViewport>
    </>
  )
}

export {
  createToaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  Toaster,
  ToastTitle,
  ToastViewport,
  toast,
}
