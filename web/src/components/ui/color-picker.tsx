"use client"

import {
  type ColorChannel,
  ColorPickerAreaCanvas as ColorPickerAreaCanvasPrimitive,
  ColorPickerArea as ColorPickerAreaPrimitive,
  ColorPickerAreaThumb as ColorPickerAreaThumbPrimitive,
  ColorPickerChannelInput as ColorPickerChannelInputPrimitive,
  ColorPickerEyeDropper as ColorPickerEyeDropperPrimitive,
  ColorPickerInput as ColorPickerInputPrimitive,
  ColorPicker as ColorPickerPrimitive,
  ColorPickerSlider as ColorPickerSliderPrimitive,
  ColorPickerSliderThumb as ColorPickerSliderThumbPrimitive,
  ColorPickerSwatches as ColorPickerSwatchesPrimitive,
  ColorPickerSwatchItem as ColorPickerSwatchItemPrimitive,
  ColorPickerSwatch as ColorPickerSwatchPrimitive,
} from "@ui-sdk/react/color-picker"
import { cn } from "cn"
import { PipetteIcon } from "lucide-react"
import type * as React from "react"

const channelLabels: Record<ColorChannel, string> = {
  hue: "色相",
  saturation: "彩度",
  brightness: "明度",
  lightness: "明るさ",
  chroma: "彩度",
  red: "赤",
  green: "緑",
  blue: "青",
  alpha: "不透明度",
}

const thumbClassName =
  "absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-(--color-picker-color) shadow-sm outline-none ring-1 ring-black/15 focus-visible:ring-[3px] focus-visible:ring-ring/50"

const fieldClassName =
  "h-9 w-full min-w-0 rounded-4xl border border-input bg-input/30 px-3 py-1 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm"

function ColorPicker({ className, ...props }: React.ComponentProps<typeof ColorPickerPrimitive>) {
  return (
    <ColorPickerPrimitive
      className={(state) =>
        cn(
          "flex w-full flex-col gap-3 data-disabled:cursor-not-allowed data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ColorPickerArea({
  className,
  ...props
}: React.ComponentProps<typeof ColorPickerAreaPrimitive>) {
  return (
    <ColorPickerAreaPrimitive
      className={(state) =>
        cn(
          "relative h-40 w-full touch-none rounded-xl [background:var(--color-area-background)]",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ColorPickerAreaCanvas({
  className,
  ...props
}: React.ComponentProps<typeof ColorPickerAreaCanvasPrimitive>) {
  return (
    <ColorPickerAreaCanvasPrimitive
      className={(state) =>
        cn(
          "absolute inset-0 size-full rounded-xl",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ColorPickerAreaThumb({
  className,
  "aria-label": ariaLabel = "彩度と明るさ",
  ...props
}: React.ComponentProps<typeof ColorPickerAreaThumbPrimitive>) {
  return (
    <ColorPickerAreaThumbPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(thumbClassName, typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function ColorPickerSlider({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ColorPickerSliderPrimitive>) {
  return (
    <ColorPickerSliderPrimitive
      className={(state) =>
        cn(
          "relative h-3 w-full shrink-0 touch-none rounded-full [background:var(--color-slider-background)] data-[orientation=vertical]:h-40 data-[orientation=vertical]:w-3",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <ColorPickerSliderThumb />}
    </ColorPickerSliderPrimitive>
  )
}

function ColorPickerSliderThumb({
  className,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<typeof ColorPickerSliderThumbPrimitive>) {
  return (
    <ColorPickerSliderThumbPrimitive
      render={(thumbProps, state) => (
        <div {...thumbProps} aria-label={ariaLabel ?? channelLabels[state.channel]} />
      )}
      className={(state) =>
        cn(
          thumbClassName,
          "top-1/2 data-[orientation=vertical]:left-1/2",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ColorPickerSwatch({
  className,
  ...props
}: React.ComponentProps<typeof ColorPickerSwatchPrimitive>) {
  return (
    <ColorPickerSwatchPrimitive
      className={(state) =>
        cn(
          "block size-8 shrink-0 rounded-lg bg-(--color-picker-color) ring-1 ring-foreground/10 ring-inset",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ColorPickerInput({
  className,
  "aria-label": ariaLabel = "カラーコード",
  ...props
}: React.ComponentProps<typeof ColorPickerInputPrimitive>) {
  return (
    <ColorPickerInputPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          fieldClassName,
          "font-mono",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ColorPickerChannelInput({
  className,
  channel,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<typeof ColorPickerChannelInputPrimitive>) {
  return (
    <ColorPickerChannelInputPrimitive
      channel={channel}
      aria-label={ariaLabel ?? (channel ? channelLabels[channel] : undefined)}
      className={(state) =>
        cn(
          fieldClassName,
          "px-2 text-center tabular-nums",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ColorPickerEyeDropper({
  className,
  children,
  "aria-label": ariaLabel = "画面から色を取得",
  ...props
}: React.ComponentProps<typeof ColorPickerEyeDropperPrimitive>) {
  return (
    <ColorPickerEyeDropperPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-4xl border border-border bg-input/30 outline-none transition-colors hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-unsupported:hidden [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <PipetteIcon aria-hidden="true" />}
    </ColorPickerEyeDropperPrimitive>
  )
}

function ColorPickerSwatches({
  className,
  "aria-label": ariaLabel = "プリセット",
  ...props
}: React.ComponentProps<typeof ColorPickerSwatchesPrimitive>) {
  return (
    <ColorPickerSwatchesPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          "flex flex-wrap gap-1.5 outline-none",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ColorPickerSwatchItem({
  className,
  ...props
}: React.ComponentProps<typeof ColorPickerSwatchItemPrimitive>) {
  return (
    <ColorPickerSwatchItemPrimitive
      className={(state) =>
        cn(
          "size-7 shrink-0 cursor-pointer rounded-md bg-(--color-picker-color) outline-none ring-1 ring-foreground/10 ring-inset transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-selected:ring-2 aria-selected:ring-foreground aria-selected:ring-offset-2 aria-selected:ring-offset-background data-disabled:cursor-not-allowed",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createColorPickerController } from "@ui-sdk/react/color-picker"
export {
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaCanvas,
  ColorPickerAreaThumb,
  ColorPickerChannelInput,
  ColorPickerEyeDropper,
  ColorPickerInput,
  ColorPickerSlider,
  ColorPickerSliderThumb,
  ColorPickerSwatch,
  ColorPickerSwatches,
  ColorPickerSwatchItem,
}
