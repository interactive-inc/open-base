import { Link, useRouter } from "@void/react"
import {
  BellIcon,
  BriefcaseIcon,
  Building2Icon,
  CircleUserIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  HandshakeIcon,
  InboxIcon,
  LogOutIcon,
  PackageIcon,
  ShieldCheckIcon,
  TargetIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react"
import { type ComponentType, type ReactNode, useEffect, useState } from "react"
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
import { Header, HeaderActions, HeaderLink, HeaderTitle } from "@/components/ui/header"
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useApiJson } from "@/components/app/use-api-json"
import { loadAuthClient } from "@/client/load-auth-client"
import { readThemeChoice, saveThemeChoice, type ThemeChoice } from "@/client/theme"

export type CurrentProfile = {
  name: string
  email: string
  dept_name: string | null
  position: string | null
  permissions: ReadonlyArray<string>
}

type NavChild = { href: string; label: string }

type NavItem = {
  href: string
  label: string
  icon: ComponentType
  /** その領域の中の画面。領域を開いている間だけ、項目の下に並ぶ。 */
  children?: ReadonlyArray<NavChild>
}

type NavSection = { label: string | null; items: ReadonlyArray<NavItem> }

/**
 * 左のメニュー。画面を足すときは、ここへ項目を足す。領域の中を行き来する画面は `children` に並べる。
 * 権限が無い人にも項目は見える。開いた先の画面が、権限なしの表示を出す。
 */
const SECTIONS: ReadonlyArray<NavSection> = [
  {
    label: null,
    items: [
      { href: "/", label: "承認", icon: InboxIcon },
      {
        href: "/applications",
        label: "申請",
        icon: FileTextIcon,
        children: [
          { href: "/applications", label: "自分の申請" },
          { href: "/applications/all", label: "全社の申請" },
          { href: "/applications/templates", label: "テンプレート" },
          { href: "/applications/delegations", label: "承認の代理" },
          { href: "/applications/repairs", label: "止まった申請の修復" },
        ],
      },
      {
        href: "/reviews",
        label: "評価",
        icon: TargetIcon,
        children: [
          { href: "/reviews", label: "評価シート" },
          { href: "/reviews/cycles", label: "評価期間" },
        ],
      },
      { href: "/notifications", label: "通知", icon: BellIcon },
    ],
  },
  {
    label: "会社",
    items: [
      { href: "/employees", label: "従業員", icon: UsersIcon },
      {
        href: "/organization",
        label: "組織",
        icon: Building2Icon,
        children: [
          { href: "/organization", label: "組織図" },
          { href: "/organization/company", label: "会社の情報" },
          { href: "/organization/grades", label: "等級" },
          { href: "/organization/grades/assignments", label: "等級の割当" },
          { href: "/organization/reporting", label: "報告ラインと判断資格" },
        ],
      },
    ],
  },
  {
    label: "業務",
    items: [
      { href: "/customers", label: "顧客", icon: HandshakeIcon },
      { href: "/offerings", label: "サービス", icon: PackageIcon },
      { href: "/projects", label: "案件", icon: BriefcaseIcon },
      { href: "/work", label: "業務の実行", icon: ClipboardCheckIcon },
    ],
  },
  {
    label: "管理",
    items: [
      {
        href: "/accounts",
        label: "アカウント",
        icon: UserCogIcon,
        children: [
          { href: "/accounts", label: "アカウント" },
          { href: "/accounts/roles", label: "ロール" },
          { href: "/accounts/principals", label: "Principal" },
        ],
      },
      {
        href: "/operations",
        label: "運用と監査",
        icon: ShieldCheckIcon,
        children: [
          { href: "/operations", label: "概要" },
          { href: "/operations/audit", label: "監査の記録" },
          { href: "/operations/work-items", label: "作業の依頼" },
          { href: "/operations/deliveries", label: "配信と再試行" },
          { href: "/operations/connectors", label: "外部接続" },
        ],
      },
    ],
  },
]

/** 今の経路がその項目の配下かどうか。ホームだけは完全一致で見る。 */
function isUnder(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}

/** 領域の中の画面のうち、今の経路に最も長く一致するもの。無ければnull。 */
function currentChild(pathname: string, children: ReadonlyArray<NavChild>): string | null {
  const matches = children.filter((child) => isUnder(pathname, child.href))
  if (matches.length === 0) return null
  return matches.reduce((longest, child) =>
    child.href.length > longest.href.length ? child : longest,
  ).href
}

type Props = {
  /** サインインしたAccountのメールアドレス。 */
  email: string
  /** ヘッダーの右に出す表示名。従業員と結び付いていない間はメールアドレスを渡す。 */
  name: string
  /** 今の画面の経路。サイドバーで現在地を示す。 */
  pathname: string
  children: ReactNode
}

/**
 * サインイン後の画面の枠。上にヘッダー、その下の左にサイドバー、右に本文を置く。
 * サイドバーの下には配色の切り替えを置く。
 * ヘッダーとサイドバーは同じ面で、本文だけがその上の一段暗い面でスクロールする。
 * Voidのレイアウト（`pages/layout.tsx`）が一度だけ描き、画面を移っても作り直さない。
 */
export function AppShell(props: Props) {
  return (
    <SidebarProvider
      aria-label="メニュー"
      className="flex-col bg-sidebar [--header-height:--spacing(14)]"
    >
      <Header>
        <SidebarTrigger aria-label="メニューを開閉" className="md:hidden" />
        <HeaderTitle>
          <HeaderLink current render={<Link href="/" />}>
            Base
          </HeaderLink>
        </HeaderTitle>
        <HeaderActions>
          <UserMenu name={props.name} email={props.email} />
        </HeaderActions>
      </Header>
      <div className="flex flex-1">
        <Sidebar variant="inset">
          {/* 画面の移動の並びをnavigationとして読ませる。高さはSidebarContentと同じく残り全部を使う。 */}
          <nav aria-label="主な画面" className="flex min-h-0 flex-1 flex-col">
            <SidebarContent>
              {SECTIONS.map((section) => (
                <SidebarGroup key={section.label ?? "main"}>
                  {section.label !== null && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <NavigationItem key={item.href} item={item} pathname={props.pathname} />
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              ))}
            </SidebarContent>
          </nav>
          <SidebarFooter>
            <ThemeSwitch />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset
          id="main-content"
          className="gap-8 bg-page p-4 md:p-6 md:peer-data-[variant=inset]:mt-0"
        >
          {props.children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

function NavigationItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const open = isUnder(pathname, item.href)
  const child = item.children === undefined || !open ? null : currentChild(pathname, item.children)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={open} render={<Link href={item.href} />}>
        <item.icon />
        <span>{item.label}</span>
      </SidebarMenuButton>
      {item.children !== undefined && open && (
        <SidebarMenuSub>
          {item.children.map((entry) => (
            <SidebarMenuSubItem key={entry.href}>
              <SidebarMenuSubButton
                isActive={entry.href === child}
                render={<Link href={entry.href} />}
              >
                <span>{entry.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}

const THEMES: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
  { value: "system", label: "システム" },
]

/** 配色の切り替え。選び方はこのブラウザーに保存する。システムはOSの配色に従う。 */
function ThemeSwitch() {
  // 保存した選び方はブラウザーでしか読めないので、描いた後に読む。
  const [choice, setChoice] = useState<ThemeChoice>("system")
  useEffect(() => setChoice(readThemeChoice()), [])
  return (
    <SegmentedControl<ThemeChoice>
      aria-label="配色"
      className="w-full"
      value={choice}
      onValueChange={(value) => {
        if (value === null) return
        setChoice(value)
        saveThemeChoice(value)
      }}
    >
      {THEMES.map((theme) => (
        <SegmentedControlItem key={theme.value} value={theme.value} className="flex-1">
          {theme.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  )
}

function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter()
  return (
    <DropdownMenu
      onAction={async (value) => {
        if (value === "profile") {
          // 再読み込みなしで移る。Voidの外（Storybookとモック）ではふつうの移動にする。
          try {
            void router.visit("/profile")
          } catch {
            window.location.assign("/profile")
          }
          return
        }
        const { authClient } = await loadAuthClient()
        await authClient.signOut()
        window.location.assign("/sign-in")
      }}
    >
      <DropdownMenuTrigger className={buttonVariants({ variant: "secondary", size: "sm" })}>
        <span className="max-w-40 truncate">{name}</span>
        <span className="sr-only">ユーザーメニュー</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="flex flex-col gap-1">
              <span className="font-medium text-foreground">{name}</span>
              <span>{email}</span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="profile">
          <CircleUserIcon />
          あなたの情報
        </DropdownMenuItem>
        <DropdownMenuItem value="sign-out">
          <LogOutIcon />
          サインアウト
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** 枠に出す表示名。profileが読めたら氏名、読めない間や未連携のときはメールアドレス。 */
export function displayName(
  profile: { kind: "ok"; data: { name: string } } | { kind: "loading" | "forbidden" | "error" },
  email: string,
): string {
  return profile.kind === "ok" ? profile.data.name : email
}

/**
 * Voidの外（Storybookとモック）で画面に枠を付ける。本人のprofileをAPIから読んで表示名にする。
 * 製品ではレイアウトが共有データから枠を描くので、これは使わない。
 */
export function StandaloneAppShell(props: {
  email: string
  pathname: string
  children: ReactNode
}) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile")
  return (
    <AppShell
      email={props.email}
      name={displayName(profile, props.email)}
      pathname={props.pathname}
    >
      {props.children}
    </AppShell>
  )
}
