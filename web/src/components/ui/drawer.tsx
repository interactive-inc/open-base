"use client"

import * as DrawerPrimitive from "@ui-sdk/react/drawer"
import { cn } from "cn"
import * as React from "react"

type DrawerProps = React.ComponentProps<typeof DrawerPrimitive.Drawer>

type DrawerContextProps = {
  hasSnapPoints: boolean
  modal: DrawerProps["modal"]
  showSwipeHandle: boolean
  swipeAxis: "x" | "y"
}

const DrawerContext = React.createContext<DrawerContextProps | null>(null)

function useDrawer() {
  const context = React.useContext(DrawerContext)

  if (!context) {
    throw new Error("useDrawer must be used within a Drawer.")
  }

  return context
}

function Drawer({
  modal = true,
  showSwipeHandle = false,
  snapPoints,
  side = "bottom",
  ...props
}: DrawerProps & {
  showSwipeHandle?: boolean
}) {
  const hasSnapPoints = snapPoints != null && snapPoints.length > 0
  const swipeAxis = side === "bottom" || side === "top" ? "y" : "x"
  const contextValue = React.useMemo(
    () => ({ hasSnapPoints, modal, showSwipeHandle, swipeAxis }) as const,
    [hasSnapPoints, modal, showSwipeHandle, swipeAxis],
  )

  return (
    <DrawerContext.Provider value={contextValue}>
      <DrawerPrimitive.Drawer modal={modal} snapPoints={snapPoints} side={side} {...props} />
    </DrawerContext.Provider>
  )
}

function DrawerTrigger({ ...props }: React.ComponentProps<typeof DrawerPrimitive.DrawerTrigger>) {
  return <DrawerPrimitive.DrawerTrigger {...props} />
}

function DrawerClose({ ...props }: React.ComponentProps<typeof DrawerPrimitive.DrawerClose>) {
  return <DrawerPrimitive.DrawerClose {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.DrawerBackdrop>) {
  return (
    <DrawerPrimitive.DrawerBackdrop
      className={(state) =>
        cn(
          // 透明度はドロワー側が動かすので、ここではアニメーションを付けない
          "fixed inset-0 z-50 min-h-dvh select-none bg-black/80 data-ending-style:pointer-events-none supports-backdrop-filter:backdrop-blur-xs",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function DrawerSwipeHandle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-swipe-handle"
      aria-hidden="true"
      className={cn(
        "relative z-10 flex shrink-0 cursor-grab transition-opacity duration-200 after:block after:shrink-0 after:rounded-full after:bg-muted active:cursor-grabbing group-data-[side=left]/drawer-content:order-last group-data-[side=top]/drawer-content:order-last group-data-[swipe-axis=x]/drawer-content:h-full group-data-[swipe-axis=y]/drawer-content:h-3 group-data-[swipe-axis=x]/drawer-content:w-3 group-data-[swipe-axis=y]/drawer-content:w-full group-data-[side=top]/drawer-content:items-start group-data-[side=bottom]/drawer-content:items-end group-data-[swipe-axis=x]/drawer-content:items-center group-data-[side=left]/drawer-content:justify-start group-data-[side=right]/drawer-content:justify-end group-data-[swipe-axis=y]/drawer-content:justify-center group-data-[swipe-axis=x]/drawer-content:after:h-[100px] group-data-[swipe-axis=y]/drawer-content:after:h-1.5 group-data-[swipe-axis=x]/drawer-content:after:w-1.5 group-data-[swipe-axis=y]/drawer-content:after:w-[100px]",
        className,
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.DrawerContent>) {
  const { hasSnapPoints, modal, showSwipeHandle, swipeAxis } = useDrawer()

  return (
    <>
      {modal === true && <DrawerOverlay />}
      <DrawerPrimitive.DrawerContent
        data-swipe-axis={swipeAxis}
        data-snap-points={hasSnapPoints ? "" : undefined}
        className={(state) =>
          cn(
            "group/drawer-content relative flex h-(--drawer-content-height) max-h-(--drawer-content-max-height,none) min-h-0 w-(--drawer-content-width,auto) flex-col rounded-4xl border border-popover bg-popover text-popover-foreground text-sm outline-none dark:border-border",
            "[scale:calc(1-var(--drawer-stack,0)*0.05)]",
            state.nestedOpen && "overflow-hidden brightness-95",
            "[--bleed:3rem] after:pointer-events-none after:absolute after:bg-(--drawer-bleed-background,var(--color-popover)) data-[swipe-axis=y]:after:inset-x-0 data-[swipe-axis=x]:after:inset-y-0 data-[side=bottom]:after:top-full data-[side=left]:after:right-full data-[side=top]:after:bottom-full data-[side=right]:after:left-full data-[swipe-axis=y]:after:h-(--bleed) data-[swipe-axis=x]:after:w-(--bleed)",
            "[--drawer-content-height:var(--drawer-height,auto)] data-[swipe-axis=y]:data-snap-points:[--drawer-content-height:100dvh] data-[swipe-axis=x]:[--drawer-content-width:75%] data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-6rem)] data-[swipe-axis=x]:sm:[--drawer-content-width:24rem]",
            "data-[swipe-axis=x]:flex-row",
            "data-[side=bottom]:origin-bottom data-[side=left]:origin-left data-[side=right]:origin-right data-[side=top]:origin-top",
            typeof className === "function" ? className(state) : className,
          )
        }
        {...props}
      >
        {(state) => (
          <>
            {showSwipeHandle && (
              <DrawerSwipeHandle className={cn(state.nestedOpen && "opacity-0")} />
            )}
            <div
              data-slot="drawer-inner"
              className={cn(
                "flex min-h-0 flex-1 select-text flex-col overflow-hidden overscroll-contain rounded-[inherit] transition-opacity duration-300 ease-[cubic-bezier(0.45,1.005,0,1.005)] group-data-dragging/drawer-content:select-none",
                state.nestedOpen && "opacity-0",
              )}
            >
              {typeof children === "function" ? children(state) : children}
            </div>
          </>
        )}
      </DrawerPrimitive.DrawerContent>
    </>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex shrink-0 flex-col gap-0.5 p-4 pb-0 group-data-[swipe-axis=y]/drawer-content:text-center md:gap-1.5 md:text-left",
        className,
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex shrink-0 flex-col gap-2 p-4 pt-0", className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.DrawerTitle>) {
  return (
    <DrawerPrimitive.DrawerTitle
      className={(state) =>
        cn(
          "font-medium text-base text-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.DrawerDescription>) {
  return (
    <DrawerPrimitive.DrawerDescription
      className={(state) =>
        cn(
          "text-balance text-muted-foreground text-sm",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function DrawerShortcut({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.DrawerShortcut>) {
  return (
    <DrawerPrimitive.DrawerShortcut
      className={(state) =>
        cn(
          "pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center rounded-sm bg-muted px-1 font-medium font-sans text-muted-foreground text-xs empty:hidden",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createDrawerController, sheetPhysics } from "@ui-sdk/react/drawer"
export {
  DrawerShortcut,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerSwipeHandle,
  DrawerTitle,
  DrawerTrigger,
}
