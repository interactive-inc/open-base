import { Rating as RatingPrimitive, RatingItem as RatingItemPrimitive } from "@ui-sdk/react/rating"
import { cn } from "cn"
import { StarIcon } from "lucide-react"
import type * as React from "react"

function ratingValueLabel(value: number, max: number) {
  return `${max}点中${value}点`
}

function Rating({
  className,
  children,
  getValueLabel = ratingValueLabel,
  ...props
}: React.ComponentProps<typeof RatingPrimitive>) {
  return (
    <RatingPrimitive
      getValueLabel={getValueLabel}
      className={(state) =>
        cn(
          "group/rating inline-flex w-fit items-center gap-0.5 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <RatingItem />}
    </RatingPrimitive>
  )
}

function RatingItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RatingItemPrimitive>) {
  return (
    <RatingItemPrimitive
      className={(state) =>
        cn(
          "relative inline-flex size-5 shrink-0 rounded-sm text-input outline-none has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 group-data-readonly/rating:has-[:focus-visible]:ring-0 [&_svg]:pointer-events-none [&_svg]:size-full",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? (
        <>
          <StarIcon aria-hidden="true" className="fill-current" />
          <StarIcon
            aria-hidden="true"
            className="absolute inset-0 fill-current text-primary [clip-path:inset(0_calc(100%-var(--rating-fill,0)*100%)_0_0)] rtl:[clip-path:inset(0_0_0_calc(100%-var(--rating-fill,0)*100%))] in-data-highlighted:text-primary/70"
          />
        </>
      )}
    </RatingItemPrimitive>
  )
}

export { createRatingController } from "@ui-sdk/react/rating"
export { Rating, RatingItem }
