"use client"

import {
  type CalendarMode,
  type CalendarValue,
  CalendarDay as CalendarDayPrimitive,
  CalendarGrid as CalendarGridPrimitive,
  CalendarHeading as CalendarHeadingPrimitive,
  CalendarMonthSelect as CalendarMonthSelectPrimitive,
  CalendarNext as CalendarNextPrimitive,
  CalendarPrevious as CalendarPreviousPrimitive,
  Calendar as CalendarPrimitive,
  CalendarWeekday as CalendarWeekdayPrimitive,
  CalendarWeekdays as CalendarWeekdaysPrimitive,
  CalendarWeeks as CalendarWeeksPrimitive,
  CalendarYearSelect as CalendarYearSelectPrimitive,
} from "@ui-sdk/react/calendar"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type * as React from "react"

import { buttonVariants } from "@/components/ui/button"

type CalendarPrimitiveProps = React.ComponentProps<typeof CalendarPrimitive>

type CalendarValueChangeDetails = Parameters<
  NonNullable<CalendarPrimitiveProps["onValueChange"]>
>[1]

type CalendarModeProps<Mode extends CalendarMode> = {
  value?: CalendarValue<Mode>
  defaultValue?: CalendarValue<Mode>
  onValueChange?: (value: CalendarValue<Mode>, details: CalendarValueChangeDetails) => void
}

type CalendarProps = Omit<
  CalendarPrimitiveProps,
  "mode" | "value" | "defaultValue" | "onValueChange"
> & {
  captionLayout?: "label" | "dropdown"
  buttonVariant?: VariantProps<typeof buttonVariants>["variant"]
} & (
    | ({ mode?: "single" } & CalendarModeProps<"single">)
    | ({ mode: "multiple" } & CalendarModeProps<"multiple">)
    | ({ mode: "range" } & CalendarModeProps<"range">)
  )

function Calendar({
  className,
  captionLayout = "label",
  buttonVariant = "ghost",
  showOutsideDays = true,
  months,
  children,
  onValueChange,
  ...props
}: CalendarProps) {
  const offsets = Array.from(
    { length: Math.max(1, Math.floor(months ?? 1) || 1) },
    (_, offset) => offset,
  )

  return (
    <CalendarPrimitive
      // UI SDK 側の型は mode と value の対応を持たないので、ここで合わせる
      onValueChange={onValueChange as CalendarPrimitiveProps["onValueChange"]}
      showOutsideDays={showOutsideDays}
      months={months}
      className={(state) =>
        cn(
          "group/calendar w-fit bg-background in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent p-3 [--cell-radius:var(--radius-4xl)] [--cell-size:--spacing(8)]",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? (
        <div className="flex flex-col gap-4">
          <div className="flex h-(--cell-size) w-full items-center justify-between gap-1">
            <CalendarPreviousPrimitive
              aria-label="前の月"
              className={cn(
                buttonVariants({ variant: buttonVariant }),
                "size-(--cell-size) select-none p-0 aria-disabled:opacity-50 data-disabled:opacity-50",
              )}
            >
              <ChevronLeftIcon className="size-4 rtl:rotate-180" />
            </CalendarPreviousPrimitive>
            <CalendarHeadingPrimitive
              className={cn(
                "select-none font-medium text-sm",
                captionLayout === "dropdown" && "sr-only",
              )}
            />
            {captionLayout === "dropdown" && (
              <div className="flex h-(--cell-size) items-center justify-center gap-1.5 font-medium text-sm">
                <CalendarMonthSelectPrimitive className="h-(--cell-size) rounded-(--cell-radius) bg-transparent px-1 font-medium text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
                <CalendarYearSelectPrimitive className="h-(--cell-size) rounded-(--cell-radius) bg-transparent px-1 font-medium text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
              </div>
            )}
            <CalendarNextPrimitive
              aria-label="次の月"
              className={cn(
                buttonVariants({ variant: buttonVariant }),
                "size-(--cell-size) select-none p-0 aria-disabled:opacity-50 data-disabled:opacity-50",
              )}
            >
              <ChevronRightIcon className="size-4 rtl:rotate-180" />
            </CalendarNextPrimitive>
          </div>
          <div className="relative flex flex-col gap-4 md:flex-row">
            {offsets.map((offset) => (
              <CalendarGridPrimitive
                key={offset}
                offset={offset}
                className="w-full border-collapse [&_tbody_tr]:mt-2 [&_td:empty]:aspect-square [&_td:empty]:w-full [&_td]:p-0 [&_tr]:flex [&_tr]:w-full"
              >
                <CalendarWeekdaysPrimitive>
                  {(index) => (
                    <CalendarWeekdayPrimitive
                      index={index}
                      className="flex-1 select-none rounded-(--cell-radius) font-normal text-[0.8rem] text-muted-foreground"
                    />
                  )}
                </CalendarWeekdaysPrimitive>
                <CalendarWeeksPrimitive>
                  {(cell) => <CalendarDayButton value={cell.date} />}
                </CalendarWeeksPrimitive>
              </CalendarGridPrimitive>
            ))}
          </div>
        </div>
      )}
    </CalendarPrimitive>
  )
}

function CalendarDayButton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CalendarDayPrimitive>) {
  return (
    <CalendarDayPrimitive
      className={(state) =>
        cn(
          "group/day relative aspect-square h-full w-full select-none rounded-(--cell-radius) p-0 text-center outline-none [&:first-child[data-selected]>span]:rounded-l-(--cell-radius) [&:last-child[data-selected]>span]:rounded-r-(--cell-radius)",
          "data-range-start:isolate data-range-start:z-0 data-range-start:rounded-l-(--cell-radius) data-range-start:bg-muted data-range-start:after:absolute data-range-start:after:inset-y-0 data-range-start:after:right-0 data-range-start:after:w-4 data-range-start:after:bg-muted",
          "data-range-middle:rounded-none",
          "data-range-end:isolate data-range-end:z-0 data-range-end:rounded-r-(--cell-radius) data-range-end:bg-muted data-range-end:after:absolute data-range-end:after:inset-y-0 data-range-end:after:left-0 data-range-end:after:w-4 data-range-end:after:bg-muted",
          "data-today:data-selected:rounded-none data-today:rounded-(--cell-radius) data-today:bg-muted data-today:text-foreground",
          "data-outside:text-muted-foreground",
          "data-disabled:text-muted-foreground data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {(state) => (
        <span
          data-slot="calendar-day-button"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 font-normal leading-none dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70",
            "group-focus-visible/day:relative group-focus-visible/day:z-10 group-focus-visible/day:border-ring group-focus-visible/day:ring-[3px] group-focus-visible/day:ring-ring/50",
            "group-[[data-selected]:not([data-range-start],[data-range-middle],[data-range-end])]/day:bg-primary group-[[data-selected]:not([data-range-start],[data-range-middle],[data-range-end])]/day:text-primary-foreground",
            "group-data-range-start/day:rounded-(--cell-radius) group-data-range-start/day:rounded-l-(--cell-radius) group-data-range-start/day:bg-primary group-data-range-start/day:text-primary-foreground",
            "group-data-range-middle/day:rounded-none group-data-range-middle/day:bg-muted group-data-range-middle/day:text-foreground",
            "group-data-range-end/day:rounded-(--cell-radius) group-data-range-end/day:rounded-r-(--cell-radius) group-data-range-end/day:bg-primary group-data-range-end/day:text-primary-foreground",
          )}
        >
          {typeof children === "function" ? children(state) : (children ?? state.label)}
        </span>
      )}
    </CalendarDayPrimitive>
  )
}

export { createCalendarController } from "@ui-sdk/react/calendar"
export { Calendar, CalendarDayButton }
