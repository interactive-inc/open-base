import {
  ListboxGroup as ListboxGroupPrimitive,
  ListboxGroupLabel as ListboxGroupLabelPrimitive,
  ListboxItemIcon as ListboxItemIconPrimitive,
  ListboxItemIndicator as ListboxItemIndicatorPrimitive,
  ListboxItem as ListboxItemPrimitive,
  Listbox as ListboxPrimitive,
  type ListboxProps,
  ListboxSeparator as ListboxSeparatorPrimitive,
  type ListboxState,
} from "@ui-sdk/react/listbox"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import type * as React from "react"

function Listbox<T = string, Multiple extends boolean | undefined = false>({
  className,
  ...props
}: ListboxProps<T, Multiple>) {
  const merged = {
    ...props,
    className: (state: ListboxState) =>
      cn(
        "flex min-w-48 flex-col gap-0.5 overflow-y-auto rounded-2xl border border-input bg-background p-1 text-sm outline-none data-[orientation=horizontal]:flex-row data-disabled:opacity-50 dark:bg-input/30",
        typeof className === "function" ? className(state) : className,
      ),
  } as ListboxProps<T, Multiple>

  return <ListboxPrimitive<T, Multiple> {...merged} />
}

function ListboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ListboxItemPrimitive>) {
  return (
    <ListboxItemPrimitive
      className={(state) =>
        cn(
          "relative flex cursor-default select-none items-center gap-2 rounded-xl py-1.5 pr-8 pl-2.5 outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 data-highlighted:bg-muted data-selected:font-medium data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children(state) : children}
          <ListboxItemIndicator />
        </>
      )}
    </ListboxItemPrimitive>
  )
}

function ListboxItemIndicator({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ListboxItemIndicatorPrimitive>) {
  return (
    <ListboxItemIndicatorPrimitive
      className={(state) =>
        cn(
          "pointer-events-none absolute right-2.5 flex items-center justify-center",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <CheckIcon aria-hidden="true" />}
    </ListboxItemIndicatorPrimitive>
  )
}

function ListboxItemIcon({
  className,
  ...props
}: React.ComponentProps<typeof ListboxItemIconPrimitive>) {
  return (
    <ListboxItemIconPrimitive
      className={(state) =>
        cn(
          "flex items-center text-muted-foreground data-mirror:rtl:-scale-x-100",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ListboxGroup({ className, ...props }: React.ComponentProps<typeof ListboxGroupPrimitive>) {
  return (
    <ListboxGroupPrimitive
      className={(state) =>
        cn("flex flex-col gap-0.5", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function ListboxGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof ListboxGroupLabelPrimitive>) {
  return (
    <ListboxGroupLabelPrimitive
      className={(state) =>
        cn(
          "px-2.5 py-1 text-muted-foreground text-xs",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ListboxSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ListboxSeparatorPrimitive>) {
  return (
    <ListboxSeparatorPrimitive
      className={(state) =>
        cn(
          "-mx-1 my-1 h-px bg-border",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createListboxController } from "@ui-sdk/react/listbox"
export {
  Listbox,
  ListboxGroup,
  ListboxGroupLabel,
  ListboxItem,
  ListboxItemIcon,
  ListboxItemIndicator,
  ListboxSeparator,
}
