import {
  SliderControl as SliderControlPrimitive,
  SliderIndicator as SliderIndicatorPrimitive,
  Slider as SliderPrimitive,
  SliderValue as SliderValuePrimitive,
  SliderThumb as SliderThumbPrimitive,
  SliderTrack as SliderTrackPrimitive,
} from "@ui-sdk/react/slider"
import { cn } from "cn"
import type * as React from "react"

type SliderProps<Value extends number | number[] = number | number[]> = Omit<
  React.ComponentProps<typeof SliderPrimitive<Value>>,
  "children"
> & {
  /** つまみの上に置く要素。SliderValue で現在の値を出すときに使う */
  children?: React.ReactNode
}

function Slider(props: SliderProps<number>): React.JSX.Element
function Slider(props: SliderProps<number[]>): React.JSX.Element
function Slider(props: SliderProps): React.JSX.Element
function Slider<Value extends number | number[]>({
  className,
  children,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderProps<Value>) {
  const thumbCount = Array.isArray(value)
    ? value.length
    : Array.isArray(defaultValue)
      ? defaultValue.length
      : 1
  const thumbIndexes = Array.from({ length: thumbCount }, (_, index) => index)

  return (
    <SliderPrimitive<Value>
      className={(state) =>
        cn(
          "data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full",
          typeof className === "function" ? className(state) : className,
        )
      }
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      {...props}
    >
      {children}
      <SliderControlPrimitive className="relative flex w-full touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-disabled:opacity-50">
        <SliderTrackPrimitive className="relative grow select-none rounded-4xl bg-muted data-[orientation=horizontal]:h-3 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-3">
          <SliderIndicatorPrimitive className="select-none rounded-full bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />
          {thumbIndexes.map((index) => (
            <SliderThumbPrimitive
              key={index}
              index={index}
              className="block size-4 shrink-0 select-none rounded-4xl border border-primary bg-white shadow-sm ring-ring/50 transition-colors hover:ring-4 focus-visible:ring-4 has-[:focus-visible]:outline-hidden has-[:focus-visible]:ring-3 data-disabled:pointer-events-none data-disabled:opacity-50"
            />
          ))}
        </SliderTrackPrimitive>
      </SliderControlPrimitive>
    </SliderPrimitive>
  )
}

export { createSliderController } from "@ui-sdk/react/slider"
function SliderValue({ className, ...props }: React.ComponentProps<typeof SliderValuePrimitive>) {
  return (
    <SliderValuePrimitive
      className={(state) =>
        cn(
          "mb-2 block text-muted-foreground text-sm tabular-nums",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { Slider, SliderValue }
