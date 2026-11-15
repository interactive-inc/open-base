"use client"

import {
  ResizableHandle as ResizableHandlePrimitive,
  ResizablePanel as ResizablePanelPrimitive,
  Resizable as ResizablePrimitive,
} from "@ui-sdk/react/resizable"
import { cn } from "cn"
import type * as React from "react"

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive>) {
  return (
    <ResizablePrimitive
      className={(state) =>
        cn(
          "flex h-full w-full data-[orientation=vertical]:flex-col",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof ResizablePanelPrimitive>) {
  return <ResizablePanelPrimitive {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  children,
  ...props
}: React.ComponentProps<typeof ResizableHandlePrimitive> & {
  withHandle?: boolean
}) {
  return (
    <ResizableHandlePrimitive
      className={(state) =>
        cn(
          "group/resizable-handle relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-1 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:translate-x-0 data-[orientation=vertical]:after:-translate-y-1/2",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {withHandle ? (
        <div className="z-10 h-6 w-1 shrink-0 rounded-lg bg-border group-data-[orientation=vertical]/resizable-handle:h-1 group-data-[orientation=vertical]/resizable-handle:w-6" />
      ) : (
        children
      )}
    </ResizableHandlePrimitive>
  )
}

export { createResizableController } from "@ui-sdk/react/resizable"
export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
