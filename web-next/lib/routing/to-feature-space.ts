import type { FeatureSpace } from "@/lib/feature/feature-types"

/**
 * URL の第 1 segment から所有者の空間を決める。
 * ホーム、受信箱、通知、`/my` の本人スコープ、`/teams` の部署スコープは本人の文脈なので my。
 * `/system` は System、`/company` は Company、それ以外は App の業務空間。
 * サイドバーのタブと URL prefix を二重管理しないため、判定はここだけに置く。
 */
export function toFeatureSpace(href: string): FeatureSpace {
  const segment = href.split("/")[1] ?? ""

  if (segment === "system") return "system"

  if (segment === "company") return "company"

  if (segment === "") return "my"

  if (segment === "my") return "my"

  if (segment === "teams") return "my"

  if (segment === "inbox") return "my"

  if (segment === "notifications") return "my"

  return "apps"
}
