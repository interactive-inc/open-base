import { type RenderProp, renderElement } from "@ui-sdk/react/primitive"
import { cn } from "cn"
import type * as React from "react"

function Header({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="header"
      className={cn(
        "sticky top-0 z-20 flex h-(--header-height,--spacing(14)) shrink-0 items-center gap-3 bg-sidebar/70 px-4 text-sm backdrop-blur-md md:px-6",
        className,
      )}
      {...props}
    />
  )
}

function HeaderTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="header-title"
      className={cn("flex min-w-0 items-center gap-3", className)}
      {...props}
    />
  )
}

function HeaderLogo({
  className,
  src,
  alt = "",
  render,
  ...props
}: React.ComponentProps<"a"> & {
  src: string
  alt?: string
  render?: RenderProp
}) {
  return renderElement(
    "a",
    {
      "data-slot": "header-logo",
      className: cn(
        "shrink-0 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      ),
      children: <img src={src} alt={alt} className="size-6 bg-foreground/10" />,
      ...props,
    },
    render,
  )
}

function HeaderSeparator({ className, children, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="header-separator"
      aria-hidden="true"
      className={cn("text-muted-foreground", className)}
      {...props}
    >
      {children ?? "/"}
    </span>
  )
}

function HeaderLink({
  className,
  current = false,
  render,
  ...props
}: React.ComponentProps<"a"> & { current?: boolean; render?: RenderProp }) {
  return renderElement(
    "a",
    {
      "data-slot": "header-link",
      "aria-current": current ? "page" : undefined,
      className: cn(
        "rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:font-medium aria-[current=page]:text-foreground",
        className,
      ),
      ...props,
    },
    render,
  )
}

function HeaderActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="header-actions"
      className={cn("ml-auto flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  )
}

export { Header, HeaderActions, HeaderLink, HeaderLogo, HeaderSeparator, HeaderTitle }
