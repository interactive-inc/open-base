"use client"

import {
  TabsList as TabsListPrimitive,
  TabsPanel as TabsPanelPrimitive,
  Tabs as TabsPrimitive,
  TabsTab as TabsTabPrimitive,
} from "@ui-sdk/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type * as React from "react"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive>) {
  return (
    <TabsPrimitive
      orientation={orientation}
      className={(state) =>
        cn(
          "group/tabs flex gap-2 data-horizontal:flex-col",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center p-[3px] text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none rounded-4xl group-data-horizontal/tabs:h-9 group-data-vertical/tabs:rounded-2xl",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsListPrimitive> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsListPrimitive
      data-variant={variant}
      className={(state) =>
        cn(
          tabsListVariants({ variant }),
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsTabPrimitive>) {
  return (
    <TabsTabPrimitive
      className={(state) =>
        cn(
          "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-transparent px-2 py-1 font-medium text-foreground/60 text-sm transition-all hover:text-foreground focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 data-disabled:pointer-events-none data-disabled:opacity-50 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:px-2.5 group-data-vertical/tabs:py-1.5 group-data-[variant=default]/tabs-list:data-[selected]:shadow-sm group-data-[variant=line]/tabs-list:data-[selected]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[selected]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[selected]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[selected]:bg-transparent",
          "data-[selected]:bg-background data-[selected]:text-foreground dark:data-[selected]:border-input dark:data-[selected]:bg-input/30 dark:data-[selected]:text-foreground",
          "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[selected]:after:opacity-100",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPanelPrimitive>) {
  return (
    <TabsPanelPrimitive
      className={(state) =>
        cn(
          "flex-1 text-sm outline-none",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createTabsController } from "@ui-sdk/react/tabs"
export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants }
