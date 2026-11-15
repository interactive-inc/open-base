import {
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIndicator,
  Menu as MenuPrimitive,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@ui-sdk/react/menu"
import { cn } from "cn"
import { CheckIcon, ChevronRightIcon } from "lucide-react"
import * as React from "react"

function DropdownMenu({ ...props }: React.ComponentProps<typeof MenuPrimitive>) {
  return <MenuPrimitive {...props} />
}

function DropdownMenuTrigger({ ...props }: React.ComponentProps<typeof MenuTrigger>) {
  return <MenuTrigger {...props} />
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: React.ComponentProps<typeof MenuContent>) {
  return (
    <MenuContent
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className={(state) =>
        cn(
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 z-50 max-h-(--available-height) min-w-48 origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-2xl bg-popover p-1 text-popover-foreground shadow-2xl outline-none ring-1 ring-foreground/5 duration-100 data-ending-style:animate-out data-open:animate-in data-ending-style:overflow-hidden dark:ring-foreground/10",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

const DropdownMenuGroupContext = React.createContext(false)

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof MenuGroup>) {
  return (
    <DropdownMenuGroupContext.Provider value={true}>
      <MenuGroup {...props} />
    </DropdownMenuGroupContext.Provider>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenuGroupLabel> & {
  inset?: boolean
}) {
  const isInGroup = React.useContext(DropdownMenuGroupContext)

  const label = (
    <MenuGroupLabel
      data-inset={inset ? "" : undefined}
      className={(state) =>
        cn(
          "px-3 py-2.5 text-muted-foreground text-xs data-inset:pl-9.5",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )

  if (isInGroup) return label

  return <MenuGroup>{label}</MenuGroup>
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  destructive = variant === "destructive",
  ...props
}: React.ComponentProps<typeof MenuItem> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <MenuItem
      data-inset={inset ? "" : undefined}
      destructive={destructive}
      className={(state) =>
        cn(
          "group/dropdown-menu-item relative flex cursor-default select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-hidden data-destructive:data-highlighted:bg-destructive/10 data-destructive:data-highlighted:text-destructive data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:pl-9.5 data-destructive:text-destructive data-highlighted:text-accent-foreground data-disabled:opacity-50 not-data-destructive:data-highlighted:**:text-accent-foreground dark:data-destructive:data-highlighted:bg-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-destructive:*:[svg]:text-destructive *:data-[slot=menu-shortcut]:ml-auto *:data-[slot=menu-shortcut]:text-muted-foreground *:data-[slot=menu-shortcut]:text-xs *:data-[slot=menu-shortcut]:tracking-widest data-highlighted:*:data-[slot=menu-shortcut]:text-accent-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof MenuSub>) {
  return <MenuSub {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Omit<React.ComponentProps<typeof MenuSubTrigger>, "children"> & {
  inset?: boolean
  children?: React.ReactNode
}) {
  return (
    <MenuSubTrigger
      data-inset={inset ? "" : undefined}
      className={(state) =>
        cn(
          "flex cursor-default select-none items-center gap-2 rounded-xl px-3 py-2 text-sm outline-hidden data-highlighted:bg-accent data-open:bg-accent data-inset:pl-9.5 data-highlighted:text-accent-foreground data-open:text-accent-foreground data-highlighted:**:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </MenuSubTrigger>
  )
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof MenuSubContent>) {
  return (
    <MenuSubContent
      className={(state) =>
        cn(
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 z-50 max-h-(--available-height) min-w-36 origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-2xl bg-popover p-1 text-popover-foreground shadow-2xl outline-none ring-1 ring-foreground/5 duration-100 data-ending-style:animate-out data-open:animate-in data-ending-style:overflow-hidden dark:ring-foreground/10",
          typeof className === "function" ? className(state) : className,
        )
      }
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  value,
  ...props
}: Omit<React.ComponentProps<typeof MenuCheckboxItem>, "children" | "value"> & {
  inset?: boolean
  value?: string
  children?: React.ReactNode
}) {
  const fallbackValue = React.useId()

  return (
    <MenuCheckboxItem
      data-inset={inset ? "" : undefined}
      className={(state) =>
        cn(
          "relative flex cursor-default select-none items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:pl-9.5 data-highlighted:text-accent-foreground data-disabled:opacity-50 data-highlighted:**:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      checked={checked}
      value={value ?? fallbackValue}
      {...props}
    >
      <MenuItemIndicator className="pointer-events-none absolute right-2 flex items-center justify-center">
        <CheckIcon />
      </MenuItemIndicator>
      {children}
    </MenuCheckboxItem>
  )
}

function DropdownMenuRadioGroup({ ...props }: React.ComponentProps<typeof MenuRadioGroup>) {
  return (
    <DropdownMenuGroupContext.Provider value={true}>
      <MenuRadioGroup {...props} />
    </DropdownMenuGroupContext.Provider>
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: Omit<React.ComponentProps<typeof MenuRadioItem>, "children"> & {
  inset?: boolean
  children?: React.ReactNode
}) {
  return (
    <MenuRadioItem
      data-inset={inset ? "" : undefined}
      className={(state) =>
        cn(
          "relative flex cursor-default select-none items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:pl-9.5 data-highlighted:text-accent-foreground data-disabled:opacity-50 data-highlighted:**:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      <MenuItemIndicator className="pointer-events-none absolute right-2 flex items-center justify-center">
        <CheckIcon />
      </MenuItemIndicator>
      {children}
    </MenuRadioItem>
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuSeparator>) {
  return (
    <MenuSeparator
      className={(state) =>
        cn(
          "-mx-1 my-1 h-px bg-border/50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<typeof MenuShortcut>) {
  return (
    <MenuShortcut
      className={(state) =>
        cn(
          "ml-auto text-muted-foreground text-xs tracking-widest group-data-highlighted/dropdown-menu-item:text-accent-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createMenuController } from "@ui-sdk/react/menu"
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}
