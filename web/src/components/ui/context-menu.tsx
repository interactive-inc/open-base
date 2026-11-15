import {
  MenuCheckboxItem,
  MenuContent,
  MenuContextTrigger,
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
} from "@ui-sdk/react/menu"
import { cn } from "cn"
import { CheckIcon, ChevronRightIcon } from "lucide-react"
import * as React from "react"

type ContextMenuName = {
  label?: string
  labelledBy?: string
}

/**
 * 右クリックする領域の名前を、開いたメニューへ渡す。
 * SDK の Menu は、ボタンから開くときだけメニューにトリガーの名前を付ける。右クリックの領域には
 * 付けないので、開いている間は role="menu" に名前がなく、エージェントの snapshot からも名前が消える
 */
const ContextMenuNameContext = React.createContext<{
  name: ContextMenuName
  setName: (name: ContextMenuName) => void
} | null>(null)

function ContextMenu({ ...props }: React.ComponentProps<typeof MenuPrimitive>) {
  const [name, setName] = React.useState<ContextMenuName>({})
  const value = React.useMemo(() => ({ name, setName }), [name])

  return (
    <ContextMenuNameContext.Provider value={value}>
      <MenuPrimitive {...props} />
    </ContextMenuNameContext.Provider>
  )
}

function ContextMenuTrigger({
  className,
  ...props
}: React.ComponentProps<typeof MenuContextTrigger>) {
  const setName = React.useContext(ContextMenuNameContext)?.setName
  const label = props["aria-label"]
  const labelledBy = props["aria-labelledby"]

  React.useEffect(() => {
    setName?.({ label, labelledBy })
  }, [setName, label, labelledBy])

  return (
    <MenuContextTrigger
      className={(state) =>
        cn("select-none", typeof className === "function" ? className(state) : className)
      }
      {...props}
    />
  )
}

function ContextMenuContent({
  className,
  align = "start",
  alignOffset = 4,
  side = "right",
  sideOffset = 0,
  ...props
}: React.ComponentProps<typeof MenuContent>) {
  const name = React.useContext(ContextMenuNameContext)?.name
  // 自分に名前が渡されていれば、それを使う
  const named = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined

  return (
    <MenuContent
      aria-label={named ? undefined : name?.label}
      aria-labelledby={named ? undefined : name?.labelledBy}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className={(state) =>
        cn(
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 z-50 max-h-(--available-height) min-w-48 origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-2xl bg-popover p-1 text-popover-foreground shadow-2xl outline-none ring-1 ring-foreground/5 duration-100 data-ending-style:animate-out data-open:animate-in",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

const ContextMenuGroupContext = React.createContext(false)

function ContextMenuGroup({ ...props }: React.ComponentProps<typeof MenuGroup>) {
  return (
    <ContextMenuGroupContext.Provider value={true}>
      <MenuGroup {...props} />
    </ContextMenuGroupContext.Provider>
  )
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenuGroupLabel> & {
  inset?: boolean
}) {
  const isInGroup = React.useContext(ContextMenuGroupContext)

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

function ContextMenuItem({
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
          "group/context-menu-item relative flex cursor-default select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-hidden data-destructive:data-highlighted:bg-destructive/10 data-destructive:data-highlighted:text-destructive data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:pl-9.5 data-destructive:text-destructive data-highlighted:text-accent-foreground data-disabled:opacity-50 dark:data-destructive:data-highlighted:bg-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-destructive:*:[svg]:text-destructive data-highlighted:*:[svg]:text-accent-foreground *:data-[slot=menu-shortcut]:ml-auto *:data-[slot=menu-shortcut]:text-muted-foreground *:data-[slot=menu-shortcut]:text-xs *:data-[slot=menu-shortcut]:tracking-widest data-highlighted:*:data-[slot=menu-shortcut]:text-accent-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ContextMenuSub({ ...props }: React.ComponentProps<typeof MenuSub>) {
  return <MenuSub {...props} />
}

function ContextMenuSubTrigger({
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
          "flex cursor-default select-none items-center rounded-xl px-3 py-2 text-sm outline-hidden data-highlighted:bg-accent data-open:bg-accent data-inset:pl-9.5 data-highlighted:text-accent-foreground data-open:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
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

function ContextMenuSubContent({
  className,
  align = "start",
  alignOffset = 4,
  side = "right",
  sideOffset = 0,
  ...props
}: React.ComponentProps<typeof MenuSubContent>) {
  return (
    <MenuSubContent
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className={(state) =>
        cn(
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-ending-style:fade-out-0 data-ending-style:zoom-out-95 z-50 max-h-(--available-height) min-w-48 origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-2xl bg-popover p-1 text-popover-foreground shadow-lg outline-none ring-1 ring-foreground/5 duration-100 data-ending-style:animate-out data-open:animate-in",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ContextMenuCheckboxItem({
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
          "relative flex cursor-default select-none items-center gap-2 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:pl-9.5 data-highlighted:text-accent-foreground data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      checked={checked}
      value={value ?? fallbackValue}
      {...props}
    >
      <MenuItemIndicator className="pointer-events-none absolute right-2">
        <CheckIcon />
      </MenuItemIndicator>
      {children}
    </MenuCheckboxItem>
  )
}

function ContextMenuRadioGroup({ ...props }: React.ComponentProps<typeof MenuRadioGroup>) {
  return (
    <ContextMenuGroupContext.Provider value={true}>
      <MenuRadioGroup {...props} />
    </ContextMenuGroupContext.Provider>
  )
}

function ContextMenuRadioItem({
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
          "relative flex cursor-default select-none items-center gap-2 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:pl-9.5 data-highlighted:text-accent-foreground data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      <MenuItemIndicator className="pointer-events-none absolute right-2">
        <CheckIcon />
      </MenuItemIndicator>
      {children}
    </MenuRadioItem>
  )
}

function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof MenuSeparator>) {
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

function ContextMenuShortcut({ className, ...props }: React.ComponentProps<typeof MenuShortcut>) {
  return (
    <MenuShortcut
      className={(state) =>
        cn(
          "ml-auto text-muted-foreground text-xs tracking-widest group-data-highlighted/context-menu-item:text-accent-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

export { createMenuController } from "@ui-sdk/react/menu"
export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
}
