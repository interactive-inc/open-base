"use client"

import { toVisibleInboxSummary } from "@/lib/inbox/to-visible-inbox-summary"
import { Blocks, Building2, CircleUser, type LucideIcon, Wrench } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { featureStatusLabels, featureTierLabels } from "@/lib/feature/feature-registry"
import { getFeatureNavigationItems } from "@/lib/feature/get-feature-navigation-items"
import { getFeatureNavigationSections } from "@/lib/feature/get-feature-navigation-sections"
import type {
  FeatureNavigationItem,
  FeatureNavigationSection,
  FeatureSpace,
} from "@/lib/feature/feature-types"
import type { FlatDepartment } from "@/lib/org/flatten-org-tree"
import { toFeatureSpace } from "@/lib/routing/to-feature-space"
import { cn } from "@/lib/utils"

export type MyDepartment = {
  code: string
  name: string
  assignment_type: "primary" | "concurrent"
}

type Props = {
  inboxCounts: import("@/lib/api/types/inbox-types").InboxCounts
  unreadNotificationCount: number
  // 本人が持つ permission キー。これに含まれる requiredPermission の項目だけ表示する。
  permissions: ReadonlyArray<string>
  // 本人が所属する部署（主配属を先頭）。部署タブの Select の既定値と「自分の部署」群に使う。
  myDepartments: ReadonlyArray<MyDepartment>
  // 全部署（組織ツリーの表示順・深さ付き）。部署タブの Select の選択肢に使う。
  allDepartments: ReadonlyArray<FlatDepartment>
  // 機能ゲートで無効化されている機能キー。該当機能の項目は表示しない。
  disabledFeatures: ReadonlyArray<string>
}

type Space = {
  key: FeatureSpace
  label: string
  icon: LucideIcon
  sections: ReadonlyArray<FeatureNavigationSection>
}

function isAllowed(
  navigationItem: FeatureNavigationItem,
  permissions: ReadonlySet<string>,
): boolean {
  if (navigationItem.visibility.kind === "everyone") return true

  if (navigationItem.visibility.kind === "permission") {
    return permissions.has(navigationItem.visibility.permission)
  }

  if (navigationItem.visibility.kind === "any-permission") {
    return navigationItem.visibility.permissions.some((permission) => permissions.has(permission))
  }

  return navigationItem.visibility.permissions.every((permission) => permissions.has(permission))
}

/**
 * permission を持つ項目だけに絞り込み、空になったセクションは畳む。
 */
function filterSections(
  sections: ReadonlyArray<FeatureNavigationSection>,
  permissions: ReadonlySet<string>,
): ReadonlyArray<FeatureNavigationSection> {
  const filteredSections: Array<FeatureNavigationSection> = []

  for (const section of sections) {
    const visibleItems = section.items.filter((navigationItem) =>
      isAllowed(navigationItem, permissions),
    )

    if (visibleItems.length === 0) continue

    filteredSections.push({ heading: section.heading, items: visibleItems })
  }

  return filteredSections
}

function isFeatureSpace(value: unknown): value is FeatureSpace {
  return value === "my" || value === "system" || value === "company" || value === "apps"
}

/** タブの列数。空間の数だけ等幅に割る。 */
const spaceGridColumns: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
}

/**
 * /teams 直下のうち部署コードでない固定ルート。部署 Select の対象にしない。
 */
const teamStaticRoutes = new Set(["reports", "approval-delegations", "new"])

function teamCodeFromPath(pathname: string): string | null {
  const matched = pathname.match(/^\/teams\/([^/]+)/)

  if (matched === null) return null

  const segment = decodeURIComponent(matched[1])

  return teamStaticRoutes.has(segment) ? null : segment
}

function isItemActive(pathname: string, item: FeatureNavigationItem): boolean {
  if (pathname === item.href) return true

  // ホームは配下全体で光らせず、完全一致のみアクティブにする。
  if (item.href === "/") {
    return false
  }

  return pathname.startsWith(`${item.href}/`)
}

/**
 * 空間タブ（自分 / システム / 会社 / 業務）を最上部に置き、選んだ空間の項目を
 * 機能レジストリのグループ別に表示するサイドバーナビ。
 * 受信箱と通知のバッジ、部署セレクタは本人の文脈なので自分タブに出す。
 */
export function SidebarNav(props: Props) {
  const pathname = usePathname()

  const router = useRouter()

  // タブの明示クリックは、その時点のパスに紐づけて保持する。ページ遷移で
  // パスが変わったら、開いたページの空間を自動選択に戻す。
  const [selectedSpace, setSelectedSpace] = useState<{
    space: FeatureSpace
    forPath: string
  } | null>(null)

  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  const activeSpace =
    selectedSpace !== null && selectedSpace.forPath === pathname
      ? selectedSpace.space
      : toFeatureSpace(pathname)

  const permissionSet = new Set(props.permissions)

  const inboxSummary = toVisibleInboxSummary(
    props.inboxCounts,
    props.permissions,
    props.disabledFeatures,
  )

  const badgeMap: Record<string, number> = {
    "/inbox": inboxSummary.total,
    "/notifications": props.unreadNotificationCount,
  }

  // 部署 Select の現在値。URL の部署 → 手動選択 → 主配属 → 全部署の先頭、の順で決める。
  const pathTeam = teamCodeFromPath(pathname)

  const isTeamPath = pathname === "/teams" || pathname.startsWith("/teams/")

  const currentTeam =
    pathTeam ??
    selectedTeam ??
    props.myDepartments[0]?.code ??
    props.allDepartments[0]?.code ??
    null

  const myDepartmentCodes = new Set(props.myDepartments.map((department) => department.code))

  const isMyDepartment = currentTeam !== null && myDepartmentCodes.has(currentTeam)

  const currentTeamName =
    currentTeam === null
      ? null
      : (props.myDepartments.find((department) => department.code === currentTeam)?.name ??
        props.allDepartments.find((department) => department.code === currentTeam)?.name ??
        currentTeam)

  const spaces: ReadonlyArray<Space> = [
    {
      key: "my",
      label: "自分",
      icon: CircleUser,
      sections: getFeatureNavigationSections(
        getFeatureNavigationItems("my", currentTeam, props.disabledFeatures),
      ),
    },
    {
      key: "system",
      label: "システム",
      icon: Wrench,
      sections: getFeatureNavigationSections(
        getFeatureNavigationItems("system", null, props.disabledFeatures),
      ),
    },
    {
      key: "company",
      label: "会社",
      icon: Building2,
      sections: getFeatureNavigationSections(
        getFeatureNavigationItems("company", null, props.disabledFeatures),
      ),
    },
    {
      key: "apps",
      label: "業務",
      icon: Blocks,
      sections: getFeatureNavigationSections(
        getFeatureNavigationItems("apps", null, props.disabledFeatures),
      ),
    },
  ]

  const visibleSpaces: Array<Space> = []

  for (const space of spaces) {
    const sections = filterSections(space.sections, permissionSet)

    if (sections.length === 0) {
      continue
    }

    visibleSpaces.push({
      key: space.key,
      label: space.label,
      icon: space.icon,
      sections,
    })
  }

  const currentSpace = visibleSpaces.find((space) => space.key === activeSpace) ?? visibleSpaces[0]

  const handleTeamChange = (code: string) => {
    setSelectedTeam(code)

    router.push(`/teams/${code}/members`)
  }

  const handleSpaceChange = (space: unknown) => {
    if (!isFeatureSpace(space)) return

    setSelectedSpace({ space, forPath: pathname })
  }

  const renderItem = (item: FeatureNavigationItem) => {
    const Icon = item.icon

    const classification = `${featureTierLabels[item.tier]}・${featureStatusLabels[item.status]}`

    return (
      <SidebarMenuItem
        key={item.href}
        data-feature={item.slug}
        data-feature-tier={item.tier}
        data-feature-status={item.status}
      >
        <SidebarMenuButton
          isActive={isItemActive(pathname, item)}
          tooltip={`${item.label}・${classification}`}
          render={
            <Link
              href={item.href}
              prefetch={item.prefetch ?? undefined}
              aria-label={item.label}
              aria-description={classification}
              title={classification}
            />
          }
        >
          <Icon
            aria-hidden="true"
            className={cn(item.status === "development" && "text-feature-development")}
          />
          <span className="truncate">{item.label}</span>

          {badgeMap[item.href] != null &&
          (badgeMap[item.href] > 0 || (item.href === "/inbox" && inboxSummary.hasMore)) ? (
            <Badge
              className="ml-auto"
              aria-label={`未処理 ${badgeMap[item.href]}${item.href === "/inbox" && inboxSummary.hasMore ? "+" : ""} 件`}
            >
              {badgeMap[item.href]}
              {item.href === "/inbox" && inboxSummary.hasMore ? "+" : ""}
            </Badge>
          ) : null}
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <Tabs value={currentSpace?.key} onValueChange={handleSpaceChange} className="gap-0">
            <TabsList
              aria-label="メニューの空間"
              className={cn("grid w-full", spaceGridColumns[visibleSpaces.length] ?? "grid-cols-4")}
            >
              {visibleSpaces.map((space) => {
                const SpaceIcon = space.icon

                return (
                  <TabsTrigger
                    key={space.key}
                    value={space.key}
                    aria-label={space.label}
                    title={space.label}
                  >
                    <SpaceIcon aria-hidden="true" />
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        </SidebarGroupContent>
      </SidebarGroup>

      {currentSpace?.key === "my" && isTeamPath && currentTeam !== null ? (
        <SidebarGroup>
          <SidebarGroupContent>
            {isMyDepartment && props.myDepartments.length >= 1 ? (
              <NativeSelect
                size="sm"
                className="w-full"
                aria-label="自分の部署"
                value={currentTeam}
                onChange={(event) => handleTeamChange(event.target.value)}
              >
                {props.myDepartments.map((department) => (
                  <NativeSelectOption key={department.code} value={department.code}>
                    {department.assignment_type === "primary"
                      ? department.name
                      : `${department.name}（兼務）`}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <p className="px-2 text-sm font-medium text-sidebar-foreground">{currentTeamName}</p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}

      {(currentSpace?.sections ?? []).map((section) => (
        <SidebarGroup key={section.heading}>
          <SidebarGroupLabel>{section.heading}</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>{section.items.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
