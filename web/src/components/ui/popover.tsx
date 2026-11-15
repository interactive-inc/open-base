import * as PopoverPrimitive from "@ui-sdk/react/popover"
import { cn } from "cn"
import type * as React from "react"

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Popover>) {
  return <PopoverPrimitive.Popover {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.PopoverTrigger>) {
  return <PopoverPrimitive.PopoverTrigger {...props} />
}

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.PopoverContent>) {
  return (
    <PopoverPrimitive.PopoverContent
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className={(state) =>
        cn(
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 z-50 flex w-72 origin-(--transform-origin) flex-col gap-4 rounded-2xl bg-popover p-4 text-popover-foreground text-sm shadow-2xl outline-hidden ring-1 ring-foreground/5 duration-100 data-ending-style:animate-out data-open:animate-in",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-sm", className)}
      {...props}
    />
  )
}

function PopoverTitle({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.PopoverTitle>) {
  return (
    <PopoverPrimitive.PopoverTitle
      className={(state) =>
        cn("font-medium text-base", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.PopoverDescription>) {
  return (
    <PopoverPrimitive.PopoverDescription
      className={(state) =>
        cn("text-muted-foreground", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function PopoverShortcut({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.PopoverShortcut>) {
  return (
    <PopoverPrimitive.PopoverShortcut
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

function PopoverClose({ ...props }: React.ComponentProps<typeof PopoverPrimitive.PopoverClose>) {
  return <PopoverPrimitive.PopoverClose {...props} />
}

export { createPopoverController } from "@ui-sdk/react/popover"
export {
  PopoverShortcut,
  PopoverClose,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
