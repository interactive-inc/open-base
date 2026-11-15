import {
  AutocompleteArrow as AutocompleteArrowPrimitive,
  AutocompleteClear as AutocompleteClearPrimitive,
  AutocompleteContent as AutocompleteContentPrimitive,
  AutocompleteEmpty as AutocompleteEmptyPrimitive,
  AutocompleteGroupLabel as AutocompleteGroupLabelPrimitive,
  AutocompleteGroup as AutocompleteGroupPrimitive,
  AutocompleteInput as AutocompleteInputPrimitive,
  AutocompleteItemIcon as AutocompleteItemIconPrimitive,
  AutocompleteItem as AutocompleteItemPrimitive,
  AutocompleteItems,
  AutocompleteItemText as AutocompleteItemTextPrimitive,
  AutocompleteLabel as AutocompleteLabelPrimitive,
  AutocompleteList as AutocompleteListPrimitive,
  Autocomplete as AutocompletePrimitive,
  AutocompleteSeparator as AutocompleteSeparatorPrimitive,
  AutocompleteStatus as AutocompleteStatusPrimitive,
  AutocompleteTrigger as AutocompleteTriggerPrimitive,
} from "@ui-sdk/react/autocomplete"
import { cn } from "cn"
import { ChevronDownIcon, XIcon } from "lucide-react"
import type * as React from "react"

const Autocomplete = AutocompletePrimitive

const iconButtonClassName =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"

function AutocompleteLabel({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteLabelPrimitive>) {
  return (
    <AutocompleteLabelPrimitive
      className={(state) =>
        cn(
          "flex w-fit select-none items-center gap-2 font-medium text-sm leading-snug data-disabled:cursor-not-allowed data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AutocompleteInput({
  className,
  showClear = false,
  showTrigger = false,
  ...props
}: Omit<React.ComponentProps<typeof AutocompleteInputPrimitive>, "className"> & {
  className?: string
  showClear?: boolean
  showTrigger?: boolean
}) {
  return (
    <div
      data-slot="autocomplete-control"
      className={cn(
        "flex h-9 w-full min-w-0 items-center gap-0.5 rounded-4xl border border-input bg-input/30 transition-colors has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-[3px] has-aria-invalid:ring-destructive/20 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50 has-[button]:pe-1 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40",
        className,
      )}
    >
      <AutocompleteInputPrimitive
        className="h-full w-full min-w-0 flex-1 bg-transparent px-3 py-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
        {...props}
      />
      {showClear && <AutocompleteClear />}
      {showTrigger && <AutocompleteTrigger />}
    </div>
  )
}

function AutocompleteTrigger({
  className,
  children,
  "aria-label": ariaLabel = "候補を表示",
  ...props
}: React.ComponentProps<typeof AutocompleteTriggerPrimitive>) {
  return (
    <AutocompleteTriggerPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          iconButtonClassName,
          "data-open:bg-muted data-open:text-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <ChevronDownIcon aria-hidden="true" />}
    </AutocompleteTriggerPrimitive>
  )
}

function AutocompleteClear({
  className,
  children,
  "aria-label": ariaLabel = "入力を消去",
  ...props
}: React.ComponentProps<typeof AutocompleteClearPrimitive>) {
  return (
    <AutocompleteClearPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(iconButtonClassName, typeof className === "function" ? className(state) : className)
      }
      {...props}
    >
      {children ?? <XIcon aria-hidden="true" />}
    </AutocompleteClearPrimitive>
  )
}

function AutocompleteContent({
  className,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof AutocompleteContentPrimitive>) {
  return (
    <AutocompleteContentPrimitive
      side={side}
      align={align}
      sideOffset={sideOffset}
      className={(state) =>
        cn(
          "group/autocomplete-content data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 relative z-50 max-h-(--available-height) w-(--anchor-width) min-w-48 max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 [--autocomplete-available-height:var(--available-height)] data-ending-style:animate-out data-open:animate-in",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AutocompleteList({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteListPrimitive>) {
  return (
    <AutocompleteListPrimitive
      className={(state) =>
        cn(
          "no-scrollbar max-h-[min(--spacing(72),var(--autocomplete-available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1 empty:hidden aria-busy:opacity-60",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AutocompleteItem({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteItemPrimitive>) {
  return (
    <AutocompleteItemPrimitive
      className={(state) =>
        cn(
          "relative flex w-full cursor-default select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50 group-data-[modality=keyboard]/autocomplete-content:data-highlighted:ring-2 group-data-[modality=keyboard]/autocomplete-content:data-highlighted:ring-ring/50 group-data-[modality=keyboard]/autocomplete-content:data-highlighted:ring-inset [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AutocompleteItemIcon({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteItemIconPrimitive>) {
  return (
    <AutocompleteItemIconPrimitive
      className={(state) =>
        cn(
          "flex shrink-0 items-center text-muted-foreground data-mirror:rtl:-scale-x-100",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AutocompleteItemText({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteItemTextPrimitive>) {
  return (
    <AutocompleteItemTextPrimitive
      className={(state) =>
        cn(
          "min-w-0 flex-1 truncate [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AutocompleteGroup({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteGroupPrimitive>) {
  return (
    <AutocompleteGroupPrimitive
      className={(state) =>
        cn("scroll-my-1", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function AutocompleteGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteGroupLabelPrimitive>) {
  return (
    <AutocompleteGroupLabelPrimitive
      className={(state) =>
        cn(
          "px-3 py-2 text-muted-foreground text-xs",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AutocompleteSeparator({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteSeparatorPrimitive>) {
  return (
    <AutocompleteSeparatorPrimitive
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

function AutocompleteEmpty({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteEmptyPrimitive>) {
  return (
    <AutocompleteEmptyPrimitive
      className={(state) =>
        cn(
          "hidden w-full justify-center py-3 text-center text-muted-foreground text-sm data-empty:flex data-loading:flex",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AutocompleteStatus({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteStatusPrimitive>) {
  return (
    <AutocompleteStatusPrimitive
      className={(state) =>
        cn(
          "px-3 py-2 text-muted-foreground text-xs",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AutocompleteArrow({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteArrowPrimitive>) {
  return (
    <AutocompleteArrowPrimitive
      className={(state) =>
        cn(
          "size-2.5 rotate-45 bg-popover",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createAutocompleteController } from "@ui-sdk/react/autocomplete"
export {
  Autocomplete,
  AutocompleteArrow,
  AutocompleteClear,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteItemIcon,
  AutocompleteItems,
  AutocompleteItemText,
  AutocompleteLabel,
  AutocompleteList,
  AutocompleteSeparator,
  AutocompleteStatus,
  AutocompleteTrigger,
}
