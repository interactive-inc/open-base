import * as SheetPrimitive from "@ui-sdk/react/dialog"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import type * as React from "react"
import { buttonVariants } from "@/components/ui/button"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Dialog>) {
  return <SheetPrimitive.Dialog {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.DialogTrigger>) {
  return <SheetPrimitive.DialogTrigger {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.DialogClose>) {
  return <SheetPrimitive.DialogClose {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.DialogBackdrop>) {
  return (
    <SheetPrimitive.DialogBackdrop
      className={(state) =>
        cn(
          "fixed inset-0 z-50 bg-black/80 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.DialogContent> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <>
      <SheetOverlay />
      <SheetPrimitive.DialogContent
        data-side={side}
        className={(state) =>
          cn(
            "fixed z-50 flex flex-col bg-popover bg-clip-padding text-popover-foreground text-sm shadow-lg transition duration-200 ease-in-out data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=bottom]:inset-x-0 data-[side=top]:inset-x-0 data-[side=left]:inset-y-0 data-[side=right]:inset-y-0 data-[side=top]:top-0 data-[side=right]:right-0 data-[side=bottom]:bottom-0 data-[side=left]:left-0 data-[side=bottom]:h-auto data-[side=left]:h-full data-[side=right]:h-full data-[side=top]:h-auto data-[side=left]:w-3/4 data-[side=right]:w-3/4 data-[side=bottom]:border-t data-[side=left]:border-r data-[side=top]:border-b data-[side=right]:border-l data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
            typeof className === "function" ? className(state) : className,
          )
        }
        {...props}
      >
        {(state) => (
          <>
            {typeof children === "function" ? children(state) : children}
            {showCloseButton && (
              <SheetPrimitive.DialogClose
                aria-label="閉じる"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "absolute top-4 right-4",
                )}
              >
                <XIcon />
              </SheetPrimitive.DialogClose>
            )}
          </>
        )}
      </SheetPrimitive.DialogContent>
    </>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-6", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-6", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.DialogTitle>) {
  return (
    <SheetPrimitive.DialogTitle
      className={(state) =>
        cn(
          "font-medium text-base text-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.DialogDescription>) {
  return (
    <SheetPrimitive.DialogDescription
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

function SheetShortcut({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.DialogShortcut>) {
  return (
    <SheetPrimitive.DialogShortcut
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
  SheetShortcut,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}
