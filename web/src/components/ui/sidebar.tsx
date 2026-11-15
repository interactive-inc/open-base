"use client"

import { type ChangeDetails, createChange, definePrimitive } from "@ui-sdk/core"
import { Button as ButtonPrimitive } from "@ui-sdk/react/button"
import { createDialogController } from "@ui-sdk/react/dialog"
import {
  type PartProps,
  type RenderProp,
  renderElement,
  usePart,
  usePrimitive,
} from "@ui-sdk/react/primitive"
import { registerShortcut, useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { PanelLeftIcon } from "lucide-react"
import * as React from "react"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useIsMobile } from "@/components/hooks/use-mobile"

const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "mod+b"

type RenderableProps<Tag extends keyof React.JSX.IntrinsicElements> = React.ComponentProps<Tag> & {
  render?: RenderProp
}

type SidebarOpenChangeReason = "trigger-press" | "rail-press" | "shortcut" | "imperative"

type SidebarCause = {
  reason?: SidebarOpenChangeReason
  event?: Event
}

type SidebarOptions = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean, details: ChangeDetails<SidebarOpenChangeReason>) => void
  mobile?: boolean
}

type SidebarWrapperState = {
  open: boolean
  openMobile: boolean
  mobile: boolean
}

/**
 * サイドバーの開閉。PC 幅の開閉 (open) とスマートフォン幅の開閉 (openMobile) を1つの状態に持ち、
 * 変更は createChange を通すので、onOpenChange は理由と操作元を受け取れて取り消せる
 */
const sidebarPrimitive = definePrimitive({
  name: "sidebar",
  options: {
    open: "boolean",
    defaultOpen: "boolean",
    onOpenChange: "callback",
    mobile: "boolean",
  },
  state: (options: SidebarOptions) => ({
    open: options.open ?? options.defaultOpen ?? true,
    openMobile: false,
    mobile: options.mobile ?? false,
    // 開閉する本体がページにあるか。ボタンが指す先になる
    panel: false,
  }),
  sync: (options) => ({
    mobile: options.mobile ?? false,
    ...(options.open === undefined ? {} : { open: options.open }),
  }),
  api: (context) => {
    const { store } = context
    const change = createChange(context)

    context.onOptions((options) => {
      if (!options.mobile && store.get().openMobile) {
        store.set({ openMobile: false })
      }
    })

    function setOpen(open: boolean, cause: SidebarCause = {}) {
      if (store.get().open === open) {
        return false
      }
      return change("open", open, {
        reason: cause.reason ?? "imperative",
        event: cause.event,
      })
    }

    function setOpenMobile(openMobile: boolean) {
      store.set({ openMobile })
    }

    return {
      setOpen,
      setOpenMobile,
      toggle(cause: SidebarCause = {}) {
        const state = store.get()
        if (state.mobile) {
          setOpenMobile(!state.openMobile)
          return true
        }
        return setOpen(!state.open, cause)
      },
      registerPanel() {
        store.set({ panel: true })
        return () => store.set({ panel: false })
      },
    }
  },
  slots: (slot) => ({
    wrapper: slot<{}, SidebarWrapperState>({
      state: (state) => ({
        open: state.open,
        openMobile: state.openMobile,
        mobile: state.mobile,
      }),
    }),
    container: slot({
      attrs: (_state, part) => ({ id: `${part.id}-panel` }),
      bind: (_el, part) => part.api.registerPanel(),
    }),
    trigger: slot({
      attrs: (state, part) => ({
        type: "button",
        "aria-expanded": state.panel ? String(state.open) : undefined,
        "aria-controls": state.panel ? `${part.id}-panel` : undefined,
      }),
      press: ({ api }, event) => {
        api.toggle({ reason: "trigger-press", event })
      },
    }),
    rail: slot({
      attrs: () => ({ type: "button" }),
      press: ({ api }, event) => {
        api.toggle({ reason: "rail-press", event })
      },
    }),
  }),
  agent: { actions: ["setOpen", "toggle"] },
})

type SidebarShortcutHandler = (event: KeyboardEvent) => void

const sidebarShortcutHandlers = new Set<SidebarShortcutHandler>()

let unregisterSidebarShortcut: (() => void) | null = null

/**
 * 1ページに SidebarProvider がいくつあっても、キーの登録は1つにする。
 * 同じキーを部品ごとに登録すると最後の1つしか動かないので、ここで全部のサイドバーへ配る
 */
function addSidebarShortcut(handler: SidebarShortcutHandler) {
  sidebarShortcutHandlers.add(handler)
  unregisterSidebarShortcut ??= registerShortcut(
    SIDEBAR_KEYBOARD_SHORTCUT,
    (event) => {
      for (const run of sidebarShortcutHandlers) {
        run(event)
      }
    },
    { description: "サイドバーを開閉" },
  )

  return () => {
    sidebarShortcutHandlers.delete(handler)
    if (sidebarShortcutHandlers.size === 0) {
      unregisterSidebarShortcut?.()
      unregisterSidebarShortcut = null
    }
  }
}

type SidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

type SidebarSheetController = ReturnType<typeof createDialogController<unknown, unknown>>

const SidebarSheetContext = React.createContext<SidebarSheetController | null>(null)

/**
 * aria-label は役割のない div では読まれないので、名前を渡されたときだけ group にする。
 * 名前は、開閉ボタンのないサイドバーをエージェントが見分ける手がかりにもなる
 */
function namedRole(props: { role?: React.AriaRole; "aria-label"?: string }) {
  if (props.role !== undefined) {
    return props.role
  }
  return props["aria-label"] === undefined ? undefined : "group"
}

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

function SidebarScope({
  api,
  open,
  openMobile,
  mobile,
  children,
}: SidebarWrapperState & {
  api: ReturnType<typeof sidebarPrimitive>["api"]
  children?: React.ReactNode
}) {
  const [sheet] = React.useState(() => createDialogController<unknown, unknown>())

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state: open ? "expanded" : "collapsed",
      open,
      setOpen: (value) => {
        api.setOpen(value)
      },
      isMobile: mobile,
      openMobile,
      setOpenMobile: api.setOpenMobile,
      toggleSidebar: () => {
        api.toggle()
      },
    }),
    [api, open, openMobile, mobile],
  )

  return (
    <SidebarSheetContext.Provider value={sheet}>
      <SidebarContext.Provider value={contextValue}>{children}</SidebarContext.Provider>
    </SidebarSheetContext.Provider>
  )
}

function SidebarProvider({
  defaultOpen = true,
  open,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: SidebarOptions["onOpenChange"]
}) {
  const isMobile = useIsMobile()
  const handle = usePrimitive(sidebarPrimitive, {
    open,
    defaultOpen: open === undefined ? defaultOpen : undefined,
    onOpenChange,
    mobile: isMobile,
  })

  const { api } = handle
  React.useEffect(() => {
    return addSidebarShortcut((event) => {
      api.toggle({ reason: "shortcut", event })
    })
  }, [api])

  return usePart(
    handle,
    "wrapper",
    {},
    {
      ...props,
      role: namedRole(props),
      style: {
        "--sidebar-width": SIDEBAR_WIDTH,
        "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
        ...style,
      } as React.CSSProperties,
      className: cn("group/sidebar-wrapper flex min-h-svh w-full", className),
      children: (state) => (
        <SidebarScope api={handle.api} {...state}>
          {children}
        </SidebarScope>
      ),
    },
    "div",
  )
}

type SidebarProps = React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
}

function Sidebar({ collapsible = "offcanvas", ...props }: SidebarProps) {
  const { isMobile } = useSidebar()

  if (collapsible === "none") {
    const { side: _side, variant: _variant, className, dir: _dir, ...rest } = props

    return (
      <div
        data-slot="sidebar"
        className={cn(
          "flex h-full w-(--sidebar-width) flex-col text-sidebar-foreground",
          className,
        )}
        {...rest}
        role={namedRole(rest)}
      />
    )
  }

  if (isMobile) {
    return (
      <SidebarSheet side={props.side} dir={props.dir} aria-label={props["aria-label"]}>
        {props.children}
      </SidebarSheet>
    )
  }

  return <SidebarPanel collapsible={collapsible} {...props} />
}

/**
 * スマートフォン幅のサイドバー。Sheet に任せ、フォーカスの閉じ込めと Escape、開いたボタンへ戻す動きを受け取る
 */
function SidebarSheet({
  side = "left",
  dir,
  children,
  "aria-label": label = "サイドバー",
}: Pick<SidebarProps, "side" | "dir" | "children" | "aria-label">) {
  const { openMobile, setOpenMobile } = useSidebar()
  const sheet = React.useContext(SidebarSheetContext)
  const content = React.useRef<HTMLDivElement>(null)

  // モーダルが開いている間はページのショートカットが止まるので、Sheet の中にも同じキーを置く
  useShortcut(SIDEBAR_KEYBOARD_SHORTCUT, () => setOpenMobile(false), {
    layer: content,
    description: "サイドバーを閉じる",
  })

  return (
    <Sheet
      controller={sheet ?? undefined}
      open={openMobile}
      onOpenChange={(open) => setOpenMobile(open)}
    >
      <SheetContent
        ref={content}
        dir={dir}
        data-sidebar="sidebar"
        data-mobile="true"
        showCloseButton={false}
        className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
          } as React.CSSProperties
        }
        side={side}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{label}</SheetTitle>
          <SheetDescription>モバイル用のサイドバーです。</SheetDescription>
        </SheetHeader>
        <div className="flex h-full w-full flex-col gap-1">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

function SidebarPanel({
  side = "left",
  variant = "sidebar",
  collapsible,
  className,
  children,
  dir: _dir,
  ...props
}: SidebarProps & { collapsible: "offcanvas" | "icon" }) {
  const { state } = useSidebar()

  const container = usePart(
    sidebarPrimitive,
    "container",
    {},
    {
      ...props,
      role: namedRole(props),
      // 画面の外へ出ている間は、中のリンクにフォーカスが入らないようにする
      inert: state === "collapsed" && collapsible === "offcanvas",
      className: cn(
        "fixed top-(--header-height,0px) bottom-0 z-10 hidden h-[calc(100svh-var(--header-height,0px))] w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear data-[side=right]:right-0 data-[side=left]:left-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)] data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] md:flex",
        variant === "floating" || variant === "inset"
          ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
          : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
        className,
      ),
      children: (
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex size-full flex-col group-data-[variant=floating]:bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
        >
          {children}
        </div>
      ),
    },
    "div",
  )

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
        )}
      />
      {container}
    </div>
  )
}

type SidebarTriggerProps = Omit<React.ComponentProps<"button">, "className"> &
  VariantProps<typeof buttonVariants> & {
    className?: string
  }

function SidebarTrigger(props: SidebarTriggerProps) {
  const { isMobile } = useSidebar()

  if (isMobile) {
    return <SidebarSheetTrigger {...props} />
  }

  return <SidebarPanelTrigger {...props} />
}

/**
 * 開閉ボタンの見た目。Button を render に渡すと、エージェントには button と sidebar（または dialog）の
 * 2つの部品に見えるので、見た目のクラスだけを借りて、部品としては1つにする
 */
function sidebarTriggerClassName({
  variant = "ghost",
  size = "icon-sm",
  className,
}: Pick<SidebarTriggerProps, "variant" | "size" | "className">) {
  return cn(
    buttonVariants({ variant, size }),
    "disabled:cursor-not-allowed disabled:opacity-50",
    className,
  )
}

/**
 * スマートフォン幅では Sheet を開くボタンになる。閉じたときにフォーカスが戻る先にもなる
 */
function SidebarSheetTrigger({
  variant,
  size,
  className,
  children,
  ...props
}: SidebarTriggerProps) {
  const sheet = React.useContext(SidebarSheetContext)

  return (
    <SheetTrigger
      controller={sheet ?? undefined}
      data-sidebar="trigger"
      aria-label="サイドバーを開閉"
      {...props}
      className={sidebarTriggerClassName({ variant, size, className })}
    >
      {children ?? <PanelLeftIcon />}
    </SheetTrigger>
  )
}

function SidebarPanelTrigger({
  variant,
  size,
  className,
  children,
  ...props
}: SidebarTriggerProps) {
  const hint = useShortcutHint(SIDEBAR_KEYBOARD_SHORTCUT)

  const part = {
    "data-sidebar": "trigger",
    "aria-label": "サイドバーを開閉",
    "aria-keyshortcuts": hint.ariaKeyshortcuts,
    ...props,
    className: sidebarTriggerClassName({ variant, size, className }),
    children: children ?? <PanelLeftIcon />,
  }

  return usePart(sidebarPrimitive, "trigger", {}, part, "button")
}

function SidebarRail({ className, ...props }: PartProps<"button">) {
  return usePart(
    sidebarPrimitive,
    "rail",
    {},
    {
      "aria-label": "サイドバーを開閉",
      tabIndex: -1,
      title: "サイドバーを開閉",
      ...props,
      className: (state) =>
        cn(
          "absolute inset-y-0 z-20 hidden w-4 transition-all ease-linear after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2",
          "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
          "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
          "group-data-[collapsible=offcanvas]:translate-x-0 hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:after:left-full",
          "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
          "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
          typeof className === "function" ? className(state) : className,
        ),
    },
    "button",
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "relative flex w-full min-w-0 flex-1 flex-col bg-background md:peer-data-[variant=inset]:bg-page md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2 md:peer-data-[variant=inset]:my-6 md:peer-data-[variant=inset]:rounded-l-2xl",
        className,
      )}
      {...props}
    />
  )
}

function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-sidebar="input"
      className={(state) =>
        cn(
          "h-8 w-full bg-background shadow-none",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2 [--radius:var(--radius-xl)]", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2 [--radius:var(--radius-xl)]", className)}
      {...props}
    />
  )
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-sidebar="separator"
      className={(state) =>
        cn(
          "mx-2 w-auto bg-sidebar-border",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-auto [--radius:var(--radius-xl)] group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col gap-1 p-2", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({ className, render, ...props }: RenderableProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "sidebar-group-label",
      "data-sidebar": "group-label",
      ...props,
      className: cn(
        "flex h-8 shrink-0 items-center rounded-md text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0 px-3",
        className,
      ),
    },
    render,
  )
}

function SidebarGroupAction({ className, ...props }: React.ComponentProps<typeof ButtonPrimitive>) {
  return (
    <ButtonPrimitive
      data-sidebar="group-action"
      className={(state) =>
        cn(
          "absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0 peer-data-[size=default]/menu-button:top-2",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate rounded-lg px-3 py-2",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "text-sm h-9",
        sm: "text-xs h-8",
        lg: "text-sm group-data-[collapsible=icon]:p-0! h-14 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function SidebarMenuButton({
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: Omit<React.ComponentProps<typeof ButtonPrimitive>, "className"> & {
  className?: string
  isActive?: boolean
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const { isMobile, state } = useSidebar()
  const buttonProps = {
    "data-sidebar": "menu-button",
    "data-size": size,
    "data-active": isActive ? "" : undefined,
    className: cn(sidebarMenuButtonVariants({ variant, size }), className),
  }

  if (!tooltip) {
    return <ButtonPrimitive {...buttonProps} {...props} />
  }

  const tooltipProps = typeof tooltip === "string" ? { children: tooltip } : tooltip

  return (
    <Tooltip disabled={state !== "collapsed" || isMobile}>
      <TooltipTrigger render={<ButtonPrimitive {...buttonProps} {...props} />} />
      <TooltipContent side="right" align="center" {...tooltipProps} />
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  showOnHover = false,
  ...props
}: React.ComponentProps<typeof ButtonPrimitive> & {
  showOnHover?: boolean
}) {
  return (
    <ButtonPrimitive
      data-sidebar="menu-action"
      className={(state) =>
        cn(
          "absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0 peer-data-[size=default]/menu-button:top-2",
          showOnHover &&
            "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 font-medium text-sidebar-foreground text-xs tabular-nums peer-hover/menu-button:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 peer-data-active/menu-button:text-sidebar-accent-foreground",
        className,
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean
}) {
  const [width] = React.useState(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  })

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-sidebar-border border-l px-2.5 py-0.5 group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative", className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  render,
  size = "md",
  isActive = false,
  className,
  ...props
}: RenderableProps<"a"> & {
  size?: "sm" | "md"
  isActive?: boolean
}) {
  return renderElement(
    "a",
    {
      "data-slot": "sidebar-menu-sub-button",
      "data-sidebar": "menu-sub-button",
      "data-size": size,
      "data-active": isActive ? "" : undefined,
      ...props,
      className: cn(
        "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden px-2 text-sidebar-foreground ring-sidebar-ring outline-hidden group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[size=md]:text-sm data-[size=sm]:text-xs data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground rounded-lg px-3 py-2",
        className,
      ),
    },
    render,
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  sidebarMenuButtonVariants,
  useSidebar,
}
