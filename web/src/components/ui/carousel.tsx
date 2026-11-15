import {
  CarouselContent as CarouselContentPrimitive,
  CarouselIndicatorGroup as CarouselIndicatorGroupPrimitive,
  CarouselIndicator as CarouselIndicatorPrimitive,
  CarouselItem as CarouselItemPrimitive,
  CarouselPlayToggle as CarouselPlayTogglePrimitive,
  CarouselNext as CarouselNextPrimitive,
  CarouselPrevious as CarouselPreviousPrimitive,
  Carousel as CarouselPrimitive,
  CarouselViewport as CarouselViewportPrimitive,
} from "@ui-sdk/react/carousel"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "lucide-react"
import type * as React from "react"

import { buttonVariants } from "@/components/ui/button"

function Carousel({ className, ...props }: React.ComponentProps<typeof CarouselPrimitive>) {
  return (
    <CarouselPrimitive
      className={(state) =>
        cn(
          "group/carousel relative",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function CarouselContent({
  className,
  ...props
}: React.ComponentProps<typeof CarouselContentPrimitive>) {
  return (
    <CarouselViewportPrimitive className="[scrollbar-width:none]">
      <CarouselContentPrimitive
        className={(state) =>
          cn(
            "flex gap-4 data-[orientation=vertical]:flex-col",
            typeof className === "function" ? className(state) : className,
          )
        }
        {...props}
      />
    </CarouselViewportPrimitive>
  )
}

function CarouselItem({ className, ...props }: React.ComponentProps<typeof CarouselItemPrimitive>) {
  return (
    <CarouselItemPrimitive
      className={(state) =>
        cn(
          "min-w-0 shrink-0 grow-0 basis-full",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function CarouselPrevious({
  className,
  variant = "outline",
  size = "icon-sm",
  children,
  "aria-label": ariaLabel = "前のスライド",
  ...props
}: React.ComponentProps<typeof CarouselPreviousPrimitive> & VariantProps<typeof buttonVariants>) {
  return (
    <CarouselPreviousPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          buttonVariants({ variant, size }),
          "absolute touch-manipulation rounded-full data-disabled:pointer-events-none data-disabled:opacity-50",
          "group-data-[orientation=horizontal]/carousel:top-1/2 group-data-[orientation=horizontal]/carousel:-start-10 group-data-[orientation=horizontal]/carousel:-translate-y-1/2",
          "group-data-[orientation=vertical]/carousel:-top-10 group-data-[orientation=vertical]/carousel:left-1/2 group-data-[orientation=vertical]/carousel:-translate-x-1/2 group-data-[orientation=vertical]/carousel:rotate-90",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <ChevronLeftIcon className="rtl:-scale-x-100" />}
    </CarouselPreviousPrimitive>
  )
}

function CarouselNext({
  className,
  variant = "outline",
  size = "icon-sm",
  children,
  "aria-label": ariaLabel = "次のスライド",
  ...props
}: React.ComponentProps<typeof CarouselNextPrimitive> & VariantProps<typeof buttonVariants>) {
  return (
    <CarouselNextPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          buttonVariants({ variant, size }),
          "absolute touch-manipulation rounded-full data-disabled:pointer-events-none data-disabled:opacity-50",
          "group-data-[orientation=horizontal]/carousel:top-1/2 group-data-[orientation=horizontal]/carousel:-end-10 group-data-[orientation=horizontal]/carousel:-translate-y-1/2",
          "group-data-[orientation=vertical]/carousel:-bottom-10 group-data-[orientation=vertical]/carousel:left-1/2 group-data-[orientation=vertical]/carousel:-translate-x-1/2 group-data-[orientation=vertical]/carousel:rotate-90",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <ChevronRightIcon className="rtl:-scale-x-100" />}
    </CarouselNextPrimitive>
  )
}

function CarouselIndicatorGroup({
  className,
  ...props
}: React.ComponentProps<typeof CarouselIndicatorGroupPrimitive>) {
  return (
    <CarouselIndicatorGroupPrimitive
      className={(state) =>
        cn(
          "flex items-center justify-center gap-1.5 pt-3",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function CarouselIndicator({
  className,
  ...props
}: React.ComponentProps<typeof CarouselIndicatorPrimitive>) {
  return (
    <CarouselIndicatorPrimitive
      className={(state) =>
        cn(
          "size-2 touch-manipulation rounded-full bg-muted-foreground/30 outline-none transition-colors after:absolute after:-inset-1.5 relative hover:bg-muted-foreground/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-selected:bg-primary",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function CarouselPlayToggle({
  className,
  variant = "outline",
  size = "icon-sm",
  children,
  "aria-label": ariaLabel = "自動再生を切り替える",
  ...props
}: React.ComponentProps<typeof CarouselPlayTogglePrimitive> & VariantProps<typeof buttonVariants>) {
  return (
    <CarouselPlayTogglePrimitive
      className={(state) =>
        cn(
          buttonVariants({ variant, size }),
          "touch-manipulation rounded-full",
          typeof className === "function" ? className(state) : className,
        )
      }
      aria-label={ariaLabel}
      {...props}
    >
      {children ?? ((state) => (state.playing ? <PauseIcon /> : <PlayIcon />))}
    </CarouselPlayTogglePrimitive>
  )
}

export { createCarouselController } from "@ui-sdk/react/carousel"
export {
  CarouselIndicator,
  CarouselIndicatorGroup,
  CarouselPlayToggle,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
}
