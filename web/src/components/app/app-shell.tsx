import { LayoutDashboard, LogOut } from "lucide-react"
import type { ComponentType, ReactNode } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import type { ApiJsonState } from "@/components/app/use-api-json"
import { loadAuthClient } from "@/client/load-auth-client"

export type CurrentProfile = {
  name: string
  email: string
  dept_name: string | null
  position: string | null
  permissions: ReadonlyArray<string>
}

type NavItem = { href: string; label: string; icon: ComponentType }

type Props = {
  /** サインインしたAccountのメールアドレス。従業員と結び付いていない間の表示名にも使う。 */
  email: string
  /** 今の画面の経路。サイドバーで現在地を示す。 */
  pathname: string
  /** 画面が読んだ本人のprofile。表示名と所属に使う。 */
  profile: ApiJsonState<CurrentProfile>
  children: ReactNode
}

/** サインイン後の画面の枠。左にサイドバー、右に本文を置く。 */
export function AppShell(props: Props) {
  const profile = props.profile

  const name = profile.kind === "ok" ? profile.data.name : props.email
  const subtitle =
    profile.kind === "ok"
      ? (profile.data.dept_name ?? "所属なし")
      : profile.kind === "forbidden"
        ? "従業員と未連携"
        : ""

  // 業務画面を足すときは、ここへ項目を足す。
  const items: ReadonlyArray<NavItem> = [
    { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  ]

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only fixed top-2 left-2 z-50 rounded-md bg-background px-4 py-2 text-sm shadow focus:not-sr-only"
      >
        本文へスキップ
      </a>

      <Sidebar collapsible="offcanvas">
        <SidebarHeader>
          <a href="/" className="flex flex-col gap-2 rounded-md p-2 hover:bg-sidebar-accent">
            <span className="text-base font-semibold tracking-wider">Base</span>
            <span className="truncate text-xs text-muted-foreground">{subtitle || " "}</span>
          </a>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={props.pathname === item.href}
                      render={<a href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <UserMenu name={name} email={props.email} />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex items-center gap-2 p-4 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold tracking-wider">Base</span>
        </header>
        <main id="main-content" className="flex flex-1 flex-col gap-8 p-4 md:p-8" tabIndex={-1}>
          {props.children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function UserMenu({ name, email }: { name: string; email: string }) {
  const initial = name.slice(0, 1).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="ユーザーメニュー"
        className={buttonVariants({ variant: "ghost", className: "w-full justify-start" })}
      >
        <Avatar>
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <span className="truncate">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">{name}</span>
              <span className="text-xs">{email}</span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            const { authClient } = await loadAuthClient()
            await authClient.signOut()
            window.location.assign("/sign-in")
          }}
        >
          <LogOut />
          <span>サインアウト</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
