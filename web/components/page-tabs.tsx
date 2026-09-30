"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Tab = {
  label: string
  href: string
  badge?: number
  badgeSuffix?: string
}

type Props = {
  tabs: ReadonlyArray<Tab>
}

/** href が pathname にマッチするか（完全一致または配下パス）。 */
function matches(pathname: string, href: string): boolean {
  if (pathname === href) return true

  return pathname.startsWith(`${href}/`)
}

/**
 * マッチする中で最長の href を持つタブだけをアクティブにする。
 * これがないと、概要タブ（/departments/:d）の href が
 * メンバータブ（/departments/:d/members）の接頭辞になり、両方が同時にアクティブになる。
 */
function activeHref(pathname: string, tabs: ReadonlyArray<Tab>): string | null {
  let bestHref: string | null = null

  for (const tab of tabs) {
    if (matches(pathname, tab.href) === false) continue

    if (bestHref === null || tab.href.length > bestHref.length) {
      bestHref = tab.href
    }
  }

  return bestHref
}

/**
 * レイアウトのヘッダに置く、ページ遷移型のタブナビゲーション。
 * shadcn の Tabs は状態切替なので、ルート遷移が必要なハブでは Link ベースの本コンポーネントを使う。
 */
export function PageTabs(props: Props) {
  const pathname = usePathname()

  const currentHref = activeHref(pathname, props.tabs)

  return (
    <nav className="flex flex-wrap items-center gap-2 border-b" aria-label="ページ内タブ">
      {props.tabs.map((tab) => {
        const active = tab.href === currentHref

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{tab.label}</span>

            {tab.badge !== undefined && (tab.badge > 0 || tab.badgeSuffix !== undefined) ? (
              <Badge
                variant="secondary"
                aria-label={`未処理 ${tab.badge}${tab.badgeSuffix ?? ""} 件`}
              >
                {tab.badge}
                {tab.badgeSuffix}
              </Badge>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
