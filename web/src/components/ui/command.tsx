"use client"

import {
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroupLabel as CommandGroupLabelPrimitive,
  CommandGroup as CommandGroupPrimitive,
  CommandInput as CommandInputPrimitive,
  CommandItem as CommandItemPrimitive,
  CommandList as CommandListPrimitive,
  Command as CommandPrimitive,
  CommandSeparator as CommandSeparatorPrimitive,
  CommandShortcut as CommandShortcutPrimitive,
  CommandStatus as CommandStatusPrimitive,
} from "@ui-sdk/react/command"
import { cn } from "cn"
import { CheckIcon, SearchIcon } from "lucide-react"
import type * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group"

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={(state) =>
        cn(
          "flex size-full flex-col overflow-hidden rounded-4xl bg-popover p-1 text-popover-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function CommandDialog({
  title = "コマンドパレット",
  description = "実行するコマンドを検索します",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
  children: React.ReactNode
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn("top-1/3 translate-y-0 overflow-hidden rounded-4xl! p-0", className)}
        showCloseButton={showCloseButton}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandInputPrimitive>) {
  return (
    <div data-slot="command-input-wrapper" className="p-1 pb-0">
      <InputGroup className="h-9 bg-input/30">
        <CommandInputPrimitive
          className={(state) =>
            cn(
              "w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
              typeof className === "function" ? className(state) : className,
            )
          }
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandListPrimitive>) {
  return (
    <CommandListPrimitive
      className={(state) =>
        cn(
          "no-scrollbar max-h-72 scroll-py-1 overflow-y-auto overflow-x-hidden outline-none",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandEmptyPrimitive>) {
  return (
    <CommandEmptyPrimitive
      className={(state) =>
        cn(
          "hidden py-6 text-center text-sm data-empty:block",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: React.ComponentProps<typeof CommandGroupPrimitive> & {
  heading?: React.ReactNode
}) {
  return (
    <CommandGroupPrimitive
      className={(state) =>
        cn(
          "overflow-hidden p-1 text-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {(state) => (
        <>
          {heading != null && (
            <CommandGroupLabelPrimitive className="px-3 py-2 font-medium text-muted-foreground text-xs">
              {heading}
            </CommandGroupLabelPrimitive>
          )}
          {typeof children === "function" ? children(state) : children}
        </>
      )}
    </CommandGroupPrimitive>
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandSeparatorPrimitive>) {
  return (
    <CommandSeparatorPrimitive
      className={(state) =>
        cn("my-1 h-px bg-border/50", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function CommandItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof CommandItemPrimitive> & {
  checked?: boolean
}) {
  return (
    <CommandItemPrimitive
      data-checked={checked ? "" : undefined}
      className={(state) =>
        cn(
          "group/command-item relative flex cursor-default select-none items-center gap-2 in-data-[slot=dialog-content]:rounded-2xl rounded-lg px-3 py-2 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-highlighted:*:[svg]:text-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children(state) : children}
          {checked !== undefined && (
            <CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-checked/command-item:opacity-100" />
          )}
        </>
      )}
    </CommandItemPrimitive>
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<typeof CommandShortcutPrimitive>) {
  return (
    <CommandShortcutPrimitive
      className={(state) =>
        cn(
          "ml-auto text-muted-foreground text-xs tracking-widest group-data-highlighted/command-item:text-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function CommandStatus({
  className,
  ...props
}: React.ComponentProps<typeof CommandStatusPrimitive>) {
  return (
    <CommandStatusPrimitive
      className={(state) =>
        cn(
          "px-3 py-2 text-muted-foreground text-xs empty:hidden",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { CommandPage, createCommandController } from "@ui-sdk/react/command"
export {
  CommandStatus,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
}
