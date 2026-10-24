import { featureGroupLabels, featureGroupOrder } from "@/lib/feature/feature-registry"
import type { FeatureNavigationItem, FeatureNavigationSection } from "@/lib/feature/feature-types"

/**
 * 機能の表示グループ順に、空のグループを除いたセクションを作る。
 */
export function getFeatureNavigationSections(
  navigationItems: ReadonlyArray<FeatureNavigationItem>,
): ReadonlyArray<FeatureNavigationSection> {
  const navigationSections: Array<FeatureNavigationSection> = []

  for (const featureGroup of featureGroupOrder) {
    const groupItems = navigationItems.filter(
      (navigationItem) => navigationItem.group === featureGroup,
    )

    if (groupItems.length === 0) continue

    navigationSections.push({
      heading: featureGroupLabels[featureGroup],
      items: groupItems,
    })
  }

  return navigationSections
}
