import {
  ComboboxChip as ComboboxChipPrimitive,
  ComboboxChipRemove as ComboboxChipRemovePrimitive,
  ComboboxChips as ComboboxChipsPrimitive,
  ComboboxChipsOverflow as ComboboxChipsOverflowPrimitive,
  ComboboxClear as ComboboxClearPrimitive,
  ComboboxCreate as ComboboxCreatePrimitive,
  ComboboxItemText as ComboboxItemTextPrimitive,
  ComboboxSelectAll as ComboboxSelectAllPrimitive,
  ComboboxStatus as ComboboxStatusPrimitive,
  ComboboxContent as ComboboxContentPrimitive,
  ComboboxEmpty as ComboboxEmptyPrimitive,
  ComboboxGroupLabel as ComboboxGroupLabelPrimitive,
  ComboboxGroup as ComboboxGroupPrimitive,
  ComboboxInput as ComboboxInputPrimitive,
  ComboboxItemIndicator as ComboboxItemIndicatorPrimitive,
  ComboboxItem as ComboboxItemPrimitive,
  ComboboxList as ComboboxListPrimitive,
  Combobox as ComboboxPrimitive,
  ComboboxSeparator as ComboboxSeparatorPrimitive,
  ComboboxTrigger as ComboboxTriggerPrimitive,
  ComboboxValue as ComboboxValuePrimitive,
} from "@ui-sdk/react/combobox"
import { cn } from "cn"
import { CheckIcon, ChevronDownIcon, MinusIcon, XIcon } from "lucide-react"
import type * as React from "react"
import { buttonVariants } from "@/components/ui/button"
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group"

const Combobox = ComboboxPrimitive

type ComboboxValuePrimitiveProps = React.ComponentProps<typeof ComboboxValuePrimitive>

type ComboboxValuePrimitiveState = Parameters<
  Extract<ComboboxValuePrimitiveProps["children"], (state: never) => unknown>
>[0]

type ComboboxValueState<T> = Omit<ComboboxValuePrimitiveState, "value"> & {
  value: T | T[] | null
  values: T[]
}

function ComboboxValue<T = string>({
  children,
  ...props
}: Omit<ComboboxValuePrimitiveProps, "children"> & {
  children?: React.ReactNode | ((state: ComboboxValueState<T>) => React.ReactNode)
}) {
  if (typeof children !== "function") {
    return <ComboboxValuePrimitive {...props}>{children}</ComboboxValuePrimitive>
  }

  return (
    <ComboboxValuePrimitive {...props}>
      {(state) => {
        const value = state.value as T | T[] | null
        const values = Array.isArray(value) ? value : value == null ? [] : [value]
        return children({ ...state, value, values })
      }}
    </ComboboxValuePrimitive>
  )
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxTriggerPrimitive>) {
  return (
    <ComboboxTriggerPrimitive
      className={(state) =>
        cn(
          "[&_svg:not([class*='size-'])]:size-4",
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
    </ComboboxTriggerPrimitive>
  )
}

function ComboboxClear({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxClearPrimitive>) {
  return (
    <ComboboxClearPrimitive
      aria-label="クリア"
      className={(state) =>
        cn(
          buttonVariants({ variant: "ghost", size: "icon-xs" }),
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      <XIcon className="pointer-events-none" />
    </ComboboxClearPrimitive>
  )
}

function ComboboxInput({
  className,
  children,
  showTrigger = true,
  showClear = false,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxInputPrimitive>, "className"> & {
  className?: string
  children?: React.ReactNode
  showTrigger?: boolean
  showClear?: boolean
}) {
  return (
    <InputGroup className={cn("w-auto", className)}>
      <ComboboxInputPrimitive
        className="h-9 w-full min-w-0 flex-1 bg-transparent py-1 ps-3 pe-9 text-base outline-none placeholder:text-muted-foreground data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50 md:text-sm"
        {...props}
      />
      <InputGroupAddon align="inline-end" className="absolute inset-y-0 end-0">
        {showTrigger && (
          <ComboboxTrigger
            aria-label="候補を開く"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-xs" }),
              "group-has-data-[slot=combobox-clear]/input-group:hidden data-open:bg-transparent",
            )}
          />
        )}
        {showClear && <ComboboxClear />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  )
}

function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  ...props
}: React.ComponentProps<typeof ComboboxContentPrimitive>) {
  return (
    <ComboboxContentPrimitive
      side={side}
      sideOffset={sideOffset}
      align={align}
      alignOffset={alignOffset}
      className={(state) =>
        cn(
          "group/combobox-content data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 relative max-h-(--available-height) w-(--anchor-width) min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 [--combobox-available-height:var(--available-height)] data-ending-style:animate-out data-open:animate-in *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-9 *:data-[slot=input-group]:border-none *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none has-[[data-slot=combobox-empty][data-empty]]:**:data-[slot=combobox-list]:p-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ComboboxList({ className, ...props }: React.ComponentProps<typeof ComboboxListPrimitive>) {
  return (
    <ComboboxListPrimitive
      className={(state) =>
        cn(
          "no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--combobox-available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxItemPrimitive>) {
  return (
    <ComboboxItemPrimitive
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
          {typeof children === "function" ? children(state) : children}
          <ComboboxItemIndicatorPrimitive className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
            <CheckIcon className="pointer-events-none" />
          </ComboboxItemIndicatorPrimitive>
        </>
      )}
    </ComboboxItemPrimitive>
  )
}

function ComboboxGroup({ ...props }: React.ComponentProps<typeof ComboboxGroupPrimitive>) {
  return <ComboboxGroupPrimitive {...props} />
}

function ComboboxLabel({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxGroupLabelPrimitive>) {
  return (
    <ComboboxGroupLabelPrimitive
      className={(state) =>
        cn(
          "px-3.5 py-2.5 text-muted-foreground text-xs",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ComboboxEmpty({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxEmptyPrimitive>) {
  return (
    <ComboboxEmptyPrimitive
      className={(state) =>
        cn(
          "hidden w-full justify-center py-2 text-center text-muted-foreground text-sm data-empty:flex",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ComboboxSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxSeparatorPrimitive>) {
  return (
    <ComboboxSeparatorPrimitive
      className={(state) =>
        cn(
          "-mx-1 my-1 h-px bg-border/50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ComboboxChips({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxChipsPrimitive>) {
  return (
    <ComboboxChipsPrimitive
      className={(state) =>
        cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-4xl border border-input bg-input/30 bg-clip-padding px-2.5 py-1.5 text-sm transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-aria-invalid:border-destructive has-data-[slot=combobox-chip]:px-1.5 has-aria-invalid:ring-[3px] has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: React.ComponentProps<typeof ComboboxChipPrimitive> & {
  showRemove?: boolean
}) {
  return (
    <ComboboxChipPrimitive
      className={(state) =>
        cn(
          "flex h-[calc(--spacing(5.5))] w-fit items-center justify-center gap-1 whitespace-nowrap rounded-4xl bg-muted-foreground/10 px-2 font-medium text-foreground text-xs has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-data-[slot=combobox-chip-remove]:pr-0 has-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children(state) : (children ?? state.label)}
          {showRemove && (
            <ComboboxChipRemovePrimitive
              aria-label={`${state.label}を外す`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-xs" }),
                "-ml-1 opacity-50 hover:opacity-100",
              )}
            >
              <XIcon className="pointer-events-none" />
            </ComboboxChipRemovePrimitive>
          )}
        </>
      )}
    </ComboboxChipPrimitive>
  )
}

function ComboboxChipsInput({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxInputPrimitive>) {
  return (
    <ComboboxInputPrimitive
      className={(state) =>
        cn(
          "min-w-16 flex-1 outline-none",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ComboboxSelectAll({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxSelectAllPrimitive>) {
  return (
    <ComboboxSelectAllPrimitive
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
          {typeof children === "function" ? children(state) : children}
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
            {state.checked && <CheckIcon />}
            {state.indeterminate && <MinusIcon />}
          </span>
        </>
      )}
    </ComboboxSelectAllPrimitive>
  )
}

function ComboboxCreate({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxCreatePrimitive>) {
  return (
    <ComboboxCreatePrimitive
      className={(state) =>
        cn(
          "relative flex w-full cursor-default select-none items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50 data-highlighted:**:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-pending:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ComboboxStatus({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxStatusPrimitive>) {
  return (
    <ComboboxStatusPrimitive
      className={(state) =>
        cn(
          "px-3 py-2 text-muted-foreground text-xs empty:hidden",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ComboboxChipsOverflow({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxChipsOverflowPrimitive>) {
  return (
    <ComboboxChipsOverflowPrimitive
      className={(state) =>
        cn(
          "whitespace-nowrap text-muted-foreground text-xs",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ComboboxItemText({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxItemTextPrimitive>) {
  return (
    <ComboboxItemTextPrimitive
      className={(state) =>
        cn(
          "[&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-inherit",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createComboboxController } from "@ui-sdk/react/combobox"
export {
  ComboboxSelectAll,
  ComboboxCreate,
  ComboboxStatus,
  ComboboxChipsOverflow,
  ComboboxItemText,
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
}
