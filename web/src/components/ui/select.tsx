import {
  SelectContent as SelectContentPrimitive,
  SelectGroupLabel as SelectGroupLabelPrimitive,
  SelectGroup as SelectGroupPrimitive,
  SelectItemIndicator as SelectItemIndicatorPrimitive,
  SelectItem as SelectItemPrimitive,
  SelectItemText as SelectItemTextPrimitive,
  Select as SelectPrimitive,
  SelectSeparator as SelectSeparatorPrimitive,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue as SelectValuePrimitive,
} from "@ui-sdk/react/select"
import { cn } from "cn"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import type * as React from "react"

const Select = SelectPrimitive

function SelectGroup({ className, ...props }: React.ComponentProps<typeof SelectGroupPrimitive>) {
  return (
    <SelectGroupPrimitive
      className={(state) =>
        cn("scroll-my-1", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: React.ComponentProps<typeof SelectValuePrimitive>) {
  return (
    <SelectValuePrimitive
      className={(state) =>
        cn("flex flex-1 text-left", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectTriggerPrimitive> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectTriggerPrimitive
      data-size={size}
      className={(state) =>
        cn(
          "flex w-fit items-center justify-between gap-1.5 whitespace-nowrap rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 data-[size=default]:h-9 data-[size=sm]:h-8 data-placeholder:text-muted-foreground *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:hover:bg-input/50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children(state) : children}
          <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
        </>
      )}
    </SelectTriggerPrimitive>
  )
}

function SelectContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: React.ComponentProps<typeof SelectContentPrimitive>) {
  return (
    <SelectContentPrimitive
      data-align-trigger={alignItemWithTrigger ? "" : undefined}
      side={side}
      sideOffset={sideOffset}
      align={align}
      alignOffset={alignOffset}
      alignItemWithTrigger={alignItemWithTrigger}
      className={(state) =>
        cn(
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-2xl bg-popover p-1 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 data-align-trigger:animate-none data-ending-style:animate-out data-open:animate-in",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectGroupLabelPrimitive>) {
  return (
    <SelectGroupLabelPrimitive
      className={(state) =>
        cn(
          "px-3 py-2.5 text-muted-foreground text-xs",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectItemPrimitive>) {
  return (
    <SelectItemPrimitive
      className={(state) =>
        cn(
          "relative flex w-full cursor-default select-none items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50 data-highlighted:**:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {(state) => (
        <>
          <SelectItemTextPrimitive className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
            {typeof children === "function" ? children(state) : children}
          </SelectItemTextPrimitive>
          <SelectItemIndicatorPrimitive className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
            <CheckIcon className="pointer-events-none" />
          </SelectItemIndicatorPrimitive>
        </>
      )}
    </SelectItemPrimitive>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectSeparatorPrimitive>) {
  return (
    <SelectSeparatorPrimitive
      className={(state) =>
        cn(
          "pointer-events-none -mx-1 my-1 h-px bg-border/50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createSelectController } from "@ui-sdk/react/select"
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
