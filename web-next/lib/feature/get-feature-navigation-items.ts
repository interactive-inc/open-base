import { featureRegistry } from "@/lib/feature/feature-registry"
import type { FeatureNavigationItem, FeatureSpace } from "@/lib/feature/feature-types"
import { toNavigationGroup } from "@/lib/feature/to-navigation-group"
import { toFeatureSpace } from "@/lib/routing/to-feature-space"

/**
 * 空間に属する表示可能な経路を、部署コードを解決して返す。
 * 空間は href の第 1 セグメントから導出する。
 * disabledFeatureSlugs（機能ゲートで無効な機能）は表示から除く。
 */
export function getFeatureNavigationItems(
  space: FeatureSpace,
  teamCode: string | null,
  disabledFeatureSlugs: ReadonlyArray<string> = [],
): ReadonlyArray<FeatureNavigationItem> {
  const navigationItems: Array<FeatureNavigationItem> = []

  const disabledSlugSet = new Set(disabledFeatureSlugs)

  for (const feature of featureRegistry) {
    if (feature.status === "retirement-candidate") continue
    if (disabledSlugSet.has(feature.slug)) continue

    for (const route of feature.routes) {
      if (toFeatureSpace(route.href) !== space) continue
      if (route.href.includes(":team") && teamCode === null) continue

      navigationItems.push({
        slug: feature.slug,
        tier: feature.tier,
        status: feature.status,
        group: toNavigationGroup(route.href, feature.group),
        icon: feature.icon,
        prefetch: feature.prefetch,
        label: route.label,
        href: route.href.replace(":team", teamCode ?? ""),
        visibility: route.visibility,
      })
    }
  }

  return navigationItems
}
