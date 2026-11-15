import {
  PaginationEllipsis as PaginationEllipsisPrimitive,
  PaginationFirst as PaginationFirstPrimitive,
  PaginationItem as PaginationItemPrimitive,
  PaginationLast as PaginationLastPrimitive,
  PaginationLink as PaginationLinkPrimitive,
  PaginationList as PaginationListPrimitive,
  PaginationNext as PaginationNextPrimitive,
  PaginationPrevious as PaginationPreviousPrimitive,
  Pagination as PaginationPrimitive,
} from "@ui-sdk/react/pagination"
import { cn } from "cn"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  MoreHorizontalIcon,
} from "lucide-react"
import type * as React from "react"
import { buttonVariants } from "@/components/ui/button"

function Pagination({
  className,
  "aria-label": ariaLabel = "ページ送り",
  ...props
}: React.ComponentProps<typeof PaginationPrimitive>) {
  return (
    <PaginationPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          "mx-auto flex w-full justify-center",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<typeof PaginationListPrimitive>) {
  return (
    <PaginationListPrimitive
      className={(state) =>
        cn(
          "flex items-center gap-1",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<typeof PaginationItemPrimitive>) {
  return <PaginationItemPrimitive {...props} />
}

function PaginationLink({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLinkPrimitive>) {
  return (
    <PaginationLinkPrimitive
      className={(state) =>
        cn(
          buttonVariants({
            variant: state.current ? "outline" : "ghost",
            size: "icon",
          }),
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function PaginationPrevious({
  className,
  text = "前へ",
  "aria-label": ariaLabel = "前のページへ",
  ...props
}: React.ComponentProps<typeof PaginationPreviousPrimitive> & {
  text?: string
}) {
  return (
    <PaginationPreviousPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          buttonVariants({ variant: "ghost" }),
          "pl-2!",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      <ChevronLeftIcon data-icon="inline-start" />
      <span className="hidden sm:block">{text}</span>
    </PaginationPreviousPrimitive>
  )
}

function PaginationNext({
  className,
  text = "次へ",
  "aria-label": ariaLabel = "次のページへ",
  ...props
}: React.ComponentProps<typeof PaginationNextPrimitive> & {
  text?: string
}) {
  return (
    <PaginationNextPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          buttonVariants({ variant: "ghost" }),
          "pr-2!",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      <span className="hidden sm:block">{text}</span>
      <ChevronRightIcon data-icon="inline-end" />
    </PaginationNextPrimitive>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<typeof PaginationEllipsisPrimitive>) {
  return (
    <PaginationEllipsisPrimitive
      className={(state) =>
        cn(
          "flex size-9 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      <MoreHorizontalIcon aria-hidden="true" />
    </PaginationEllipsisPrimitive>
  )
}

function PaginationFirst({
  className,
  children,
  "aria-label": ariaLabel = "最初のページへ",
  ...props
}: React.ComponentProps<typeof PaginationFirstPrimitive>) {
  return (
    <PaginationFirstPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <ChevronsLeftIcon className="rtl:-scale-x-100" />}
    </PaginationFirstPrimitive>
  )
}

function PaginationLast({
  className,
  children,
  "aria-label": ariaLabel = "最後のページへ",
  ...props
}: React.ComponentProps<typeof PaginationLastPrimitive>) {
  return (
    <PaginationLastPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <ChevronsRightIcon className="rtl:-scale-x-100" />}
    </PaginationLastPrimitive>
  )
}

export { createPaginationController, paginationRange } from "@ui-sdk/react/pagination"
export {
  PaginationFirst,
  PaginationLast,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
