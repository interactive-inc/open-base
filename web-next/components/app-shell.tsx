"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CommandPalette } from "@/components/command-palette"
import { FeatureDisabledScreen } from "@/components/feature-disabled-screen"
import { SidebarNav } from "@/components/sidebar-nav"
import { SidebarUserMenu } from "@/components/sidebar-user-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import type { MeResponse } from "@/lib/api/types/auth-types"
import type { InboxCounts } from "@/lib/api/types/inbox-types"
import type { FlatDepartment } from "@/lib/org/flatten-org-tree"
import type { MyDepartment } from "@/components/sidebar-nav"
import type { Locale } from "@/lib/i18n/locale"
import { isPathOfDisabledFeature } from "@/lib/feature/is-path-of-disabled-feature"

type Props = {
  children: React.ReactNode
  currentUser: MeResponse
  inboxCounts: InboxCounts
  locale: Locale
  myDepartments: ReadonlyArray<MyDepartment>
  allDepartments: ReadonlyArray<FlatDepartment>
  onLogout: () => void
  unreadNotificationCount: number
  // 機能ゲートで無効化されている機能キー。ナビから隠し、該当画面は案内に差し替える。
  disabledFeatures: ReadonlyArray<string>
}

/**
 * サイドバー開閉状態を持つアプリ全体シェル。サイドバーは背景色を本文と揃えて境界線を消す。
 */
export function AppShell(props: Props) {
  const deptLabel = props.currentUser.dept_name ?? "所属未設定"

  const pathname = usePathname()

  // 表示の出し分けのみ。強制は api 側の feature gate（無効ルートは 404）が担う。
  const isFeatureDisabledPath = isPathOfDisabledFeature(pathname, props.disabledFeatures)

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
          <Link
            href="/"
            className="flex flex-col gap-2 rounded-md px-2 py-2 hover:bg-sidebar-accent"
          >
            <span className="text-base font-semibold tracking-wider">
              {process.env.NEXT_PUBLIC_APP_NAME ?? "Open Base"}
            </span>

            <span className="text-xs text-muted-foreground">{deptLabel}</span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarNav
            inboxCounts={props.inboxCounts}
            unreadNotificationCount={props.unreadNotificationCount}
            permissions={props.currentUser.permissions}
            myDepartments={props.myDepartments}
            allDepartments={props.allDepartments}
            disabledFeatures={props.disabledFeatures}
          />
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-2">
            {/* 設定の入口は隣のユーザーメニューに寄せたので、氏名はリンクにしない。 */}
            <div className="flex min-w-0 flex-1 flex-col gap-2 px-2 py-2">
              <span className="truncate text-sm font-medium">{props.currentUser.name}</span>

              <span className="truncate text-xs text-muted-foreground">
                {props.currentUser.role_keys.join(", ") || props.currentUser.role}
              </span>
            </div>

            <SidebarUserMenu
              currentUser={props.currentUser}
              locale={props.locale}
              onLogout={props.onLogout}
              unreadNotificationCount={props.unreadNotificationCount}
            />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <main id="main-content" className="flex flex-1 flex-col gap-4 p-4 md:p-8" tabIndex={-1}>
          {isFeatureDisabledPath ? <FeatureDisabledScreen /> : props.children}
        </main>
      </SidebarInset>

      <CommandPalette inboxCounts={props.inboxCounts} permissions={props.currentUser.permissions} />
    </SidebarProvider>
  )
}
