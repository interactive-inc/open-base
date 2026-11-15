import * as DialogPrimitive from "@ui-sdk/react/dialog"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import type * as React from "react"
import { buttonVariants } from "@/components/ui/button"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Dialog>) {
  return <DialogPrimitive.Dialog {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.DialogTrigger>) {
  return <DialogPrimitive.DialogTrigger {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.DialogClose>) {
  return <DialogPrimitive.DialogClose {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.DialogBackdrop>) {
  return (
    <DialogPrimitive.DialogBackdrop
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

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.DialogContent> & {
  showCloseButton?: boolean
}) {
  return (
    <>
      <DialogOverlay />
      <DialogPrimitive.DialogContent
        className={(state) =>
          cn(
            "data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-4xl bg-popover p-6 text-popover-foreground text-sm outline-none ring-1 ring-foreground/5 duration-100 data-ending-style:animate-out data-open:animate-in sm:max-w-md",
            typeof className === "function" ? className(state) : className,
          )
        }
        {...props}
      >
        {(state) => (
          <>
            {typeof children === "function" ? children(state) : children}
            {showCloseButton && (
              <DialogPrimitive.DialogClose
                aria-label="閉じる"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "absolute top-4 right-4",
                )}
              >
                <XIcon />
              </DialogPrimitive.DialogClose>
            )}
          </>
        )}
      </DialogPrimitive.DialogContent>
    </>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.DialogClose className={buttonVariants({ variant: "outline" })}>
          閉じる
        </DialogPrimitive.DialogClose>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.DialogTitle>) {
  return (
    <DialogPrimitive.DialogTitle
      className={(state) =>
        cn(
          "font-medium text-base leading-none",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.DialogDescription>) {
  return (
    <DialogPrimitive.DialogDescription
      className={(state) =>
        cn(
          "text-muted-foreground text-sm *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function DialogShortcut({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.DialogShortcut>) {
  return (
    <DialogPrimitive.DialogShortcut
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

export { createDialogController } from "@ui-sdk/react/dialog"
export {
  DialogShortcut,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
}
