import {
  CalendarDay,
  CalendarGrid,
  CalendarHeading,
  CalendarNext,
  CalendarPrevious,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
  DatePickerClear as DatePickerClearPrimitive,
  DatePickerContent as DatePickerContentPrimitive,
  DatePickerHint as DatePickerHintPrimitive,
  DatePickerInput as DatePickerInputPrimitive,
  DatePickerPreset as DatePickerPresetPrimitive,
  DatePicker as DatePickerPrimitive,
  DatePickerTrigger as DatePickerTriggerPrimitive,
} from "@ui-sdk/react/date-picker"
import { cn } from "cn"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"
import type * as React from "react"

const iconButtonClassName =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"

function DatePicker({ className, ...props }: React.ComponentProps<typeof DatePickerPrimitive>) {
  return (
    <DatePickerPrimitive
      className={(state) =>
        cn(
          "group/date-picker flex w-full flex-col gap-1.5",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function DatePickerGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="date-picker-group"
      className={cn(
        "flex h-9 w-full min-w-0 items-center gap-0.5 rounded-4xl border border-input bg-input/30 pe-1 transition-colors has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-[3px] has-aria-invalid:ring-destructive/20 group-data-invalid/date-picker:border-destructive group-data-invalid/date-picker:ring-[3px] group-data-invalid/date-picker:ring-destructive/20 group-data-disabled/date-picker:cursor-not-allowed group-data-disabled/date-picker:opacity-50 dark:has-aria-invalid:border-destructive/50 dark:group-data-invalid/date-picker:border-destructive/50",
        className,
      )}
      {...props}
    />
  )
}

function DatePickerInput({
  className,
  ...props
}: React.ComponentProps<typeof DatePickerInputPrimitive>) {
  return (
    <DatePickerInputPrimitive
      className={(state) =>
        cn(
          "h-full w-full min-w-0 flex-1 bg-transparent py-1 ps-3 text-base tabular-nums outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function DatePickerSeparator({
  className,
  children = "〜",
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      data-slot="date-picker-separator"
      className={cn("shrink-0 px-1 text-muted-foreground text-sm", className)}
      {...props}
    >
      {children}
    </span>
  )
}

function DatePickerTrigger({
  className,
  children,
  "aria-label": ariaLabel = "カレンダーを開く",
  ...props
}: React.ComponentProps<typeof DatePickerTriggerPrimitive>) {
  return (
    <DatePickerTriggerPrimitive
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
      {children ?? <CalendarIcon aria-hidden="true" />}
    </DatePickerTriggerPrimitive>
  )
}

function DatePickerClear({
  className,
  children,
  "aria-label": ariaLabel = "日付を消去",
  ...props
}: React.ComponentProps<typeof DatePickerClearPrimitive>) {
  return (
    <DatePickerClearPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          iconButtonClassName,
          "data-empty:hidden",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <XIcon aria-hidden="true" />}
    </DatePickerClearPrimitive>
  )
}

function DatePickerHint({
  className,
  ...props
}: React.ComponentProps<typeof DatePickerHintPrimitive>) {
  return (
    <DatePickerHintPrimitive
      className={(state) =>
        cn(
          "text-muted-foreground text-xs",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function DatePickerContent({
  className,
  children,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DatePickerContentPrimitive>) {
  return (
    <DatePickerContentPrimitive
      side={side}
      align={align}
      sideOffset={sideOffset}
      className={(state) =>
        cn(
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 z-50 flex w-fit origin-(--transform-origin) flex-col gap-3 rounded-2xl bg-popover p-3 text-popover-foreground text-sm shadow-2xl outline-hidden ring-1 ring-foreground/5 duration-100 data-ending-style:animate-out data-open:animate-in",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <DatePickerCalendar />}
    </DatePickerContentPrimitive>
  )
}

function DatePickerCalendar({
  className,
  months = 1,
  ...props
}: React.ComponentProps<"div"> & { months?: number }) {
  const count = Math.max(1, Math.floor(months) || 1)

  return (
    <div
      data-slot="date-picker-calendar"
      className={cn("flex flex-col gap-3 [--cell-size:--spacing(8)]", className)}
      {...props}
    >
      <div className="flex h-(--cell-size) items-center justify-between gap-1">
        <CalendarPrevious aria-label="前の月" className={iconButtonClassName}>
          <ChevronLeftIcon aria-hidden="true" className="rtl:rotate-180" />
        </CalendarPrevious>
        <CalendarHeading className="select-none font-medium text-sm" />
        <CalendarNext aria-label="次の月" className={iconButtonClassName}>
          <ChevronRightIcon aria-hidden="true" className="rtl:rotate-180" />
        </CalendarNext>
      </div>
      <div className="flex flex-col gap-4 md:flex-row">
        {Array.from({ length: count }, (_, offset) => (
          <CalendarGrid
            // biome-ignore lint/suspicious/noArrayIndexKey: a grid is identified by its month offset
            key={offset}
            offset={offset}
            className="border-collapse [&_td]:p-0 [&_tr]:flex"
          >
            <CalendarWeekdays>
              {(index) => (
                <CalendarWeekday
                  index={index}
                  className="w-(--cell-size) select-none pb-1 font-normal text-[0.8rem] text-muted-foreground"
                />
              )}
            </CalendarWeekdays>
            <CalendarWeeks>
              {(cell) => (
                <CalendarDay
                  value={cell.date}
                  className="relative flex size-(--cell-size) select-none items-center justify-center rounded-full text-sm tabular-nums outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 data-today:bg-muted data-today:font-medium data-outside:text-muted-foreground data-selected:bg-primary data-selected:text-primary-foreground data-selected:data-range-middle:rounded-none data-selected:data-range-middle:bg-muted data-selected:data-range-middle:text-foreground data-disabled:pointer-events-none data-disabled:text-muted-foreground data-disabled:opacity-50 data-unavailable:text-muted-foreground data-unavailable:line-through"
                />
              )}
            </CalendarWeeks>
          </CalendarGrid>
        ))}
      </div>
    </div>
  )
}

function DatePickerPresets({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="date-picker-presets"
      className={cn("flex flex-wrap gap-1.5", className)}
      {...props}
    />
  )
}

function DatePickerPreset({
  className,
  ...props
}: React.ComponentProps<typeof DatePickerPresetPrimitive>) {
  return (
    <DatePickerPresetPrimitive
      className={(state) =>
        cn(
          "inline-flex h-7 shrink-0 items-center rounded-4xl border border-border bg-input/30 px-2.5 font-medium text-xs outline-none transition-colors hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-selected:border-primary data-selected:bg-primary data-selected:text-primary-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createDatePickerController } from "@ui-sdk/react/date-picker"
export {
  DatePicker,
  DatePickerCalendar,
  DatePickerClear,
  DatePickerContent,
  DatePickerGroup,
  DatePickerHint,
  DatePickerInput,
  DatePickerPreset,
  DatePickerPresets,
  DatePickerSeparator,
  DatePickerTrigger,
}
