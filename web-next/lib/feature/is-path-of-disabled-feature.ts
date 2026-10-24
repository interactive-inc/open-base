import { inboxTypes } from "@/lib/inbox/visible-inbox-types"
import { featureRegistry } from "@/lib/feature/feature-registry"

/**
 * 現在のパスが、無効化された機能の画面かを feature-registry の href で判定する。
 * href の動的セグメント（:team 等）は任意の 1 セグメントとして照合し、
 * href 自身とその配下（href + "/…"）を同じ機能の画面とみなす。
 */
export function isPathOfDisabledFeature(
  path: string,
  disabledFeatureSlugs: ReadonlyArray<string>,
): boolean {
  if (disabledFeatureSlugs.length === 0) {
    return false
  }

  const disabledSlugSet = new Set(disabledFeatureSlugs)

  for (const inboxType of inboxTypes) {
    if (
      inboxType.featureKey !== null &&
      disabledSlugSet.has(inboxType.featureKey) &&
      (path === inboxType.href || path.startsWith(`${inboxType.href}/`))
    )
      return true
  }

  for (const feature of featureRegistry) {
    if (disabledSlugSet.has(feature.slug) === false) {
      continue
    }

    for (const route of feature.routes) {
      const pattern = route.href
        .split("/")
        .map((segment) => (segment.startsWith(":") ? "[^/]+" : escapeRegExp(segment)))
        .join("/")

      if (new RegExp(`^${pattern}(?:/|$)`).test(path)) {
        return true
      }
    }
  }

  return false
}

function escapeRegExp(segment: string): string {
  return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
