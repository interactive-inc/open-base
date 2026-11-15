import {
  TreeGroup as TreeGroupPrimitive,
  TreeItemCheckbox as TreeItemCheckboxPrimitive,
  TreeItemIndicator as TreeItemIndicatorPrimitive,
  TreeItemLabel as TreeItemLabelPrimitive,
  TreeItem as TreeItemPrimitive,
  Tree as TreePrimitive,
  type TreeMode,
  type TreeProps,
} from "@ui-sdk/react/tree"
import { cn } from "cn"
import { CheckIcon, ChevronRightIcon, MinusIcon } from "lucide-react"
import type * as React from "react"

function Tree<Mode extends TreeMode = "single">({
  className,
  pendingAnnouncement = "処理しています",
  ...props
}: TreeProps<Mode>) {
  return (
    <TreePrimitive<Mode>
      pendingAnnouncement={pendingAnnouncement}
      className={(state) =>
        cn(
          "flex w-full flex-col gap-0.5 text-sm data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TreeItem({ className, ...props }: React.ComponentProps<typeof TreeItemPrimitive>) {
  return (
    <TreeItemPrimitive
      className={(state) =>
        cn(
          "flex flex-col gap-0.5 outline-none [&:focus-visible>[data-slot=tree-label]]:ring-[3px] [&:focus-visible>[data-slot=tree-label]]:ring-ring/50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TreeItemLabel({
  className,
  ...props
}: React.ComponentProps<typeof TreeItemLabelPrimitive>) {
  return (
    <TreeItemLabelPrimitive
      className={(state) =>
        cn(
          "flex min-h-8 cursor-default select-none items-center gap-2 rounded-xl py-1.5 pr-2.5 ps-[calc((var(--tree-level,1)-1)*1.25rem+0.5rem)] transition-colors hover:bg-muted data-current:font-medium data-selected:bg-muted data-selected:font-medium data-disabled:pointer-events-none data-disabled:opacity-50 data-pending:cursor-wait [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TreeItemIndicator({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TreeItemIndicatorPrimitive>) {
  return (
    <TreeItemIndicatorPrimitive
      className={(state) =>
        cn(
          "flex size-4 items-center justify-center text-muted-foreground transition-transform not-data-branch:invisible data-expanded:rotate-90 motion-reduce:transition-none rtl:-scale-x-100",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <ChevronRightIcon aria-hidden="true" />}
    </TreeItemIndicatorPrimitive>
  )
}

function TreeItemCheckbox({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TreeItemCheckboxPrimitive>) {
  return (
    <TreeItemCheckboxPrimitive
      className={(state) =>
        cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[6px] border border-input text-primary-foreground data-checked:border-primary data-indeterminate:border-primary data-checked:bg-primary data-indeterminate:bg-primary dark:bg-input/30 dark:data-checked:bg-primary dark:data-indeterminate:bg-primary [&_svg]:size-3.5",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ??
        ((state) =>
          state.checked === "indeterminate" ? (
            <MinusIcon aria-hidden="true" />
          ) : state.checked ? (
            <CheckIcon aria-hidden="true" />
          ) : null)}
    </TreeItemCheckboxPrimitive>
  )
}

function TreeGroup({ className, ...props }: React.ComponentProps<typeof TreeGroupPrimitive>) {
  return (
    <TreeGroupPrimitive
      className={(state) =>
        cn("flex flex-col gap-0.5", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

export type { TreeItemData } from "@ui-sdk/react/tree"
export {
  createTreeController,
  toggleTreeChecked,
  treeCheckedStates,
  treeFromPaths,
  visibleTreeRows,
} from "@ui-sdk/react/tree"
export { Tree, TreeGroup, TreeItem, TreeItemCheckbox, TreeItemIndicator, TreeItemLabel }
