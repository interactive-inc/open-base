import { describe, expect, test } from "vite-plus/test"
import { featureRegistry } from "@/lib/feature/feature-registry"

/**
 * サイドバーは本人と部署の項目を同じ「自分」空間に並べて表示する
 * （components/sidebar-nav.tsx の "my" 空間。全社ビューだけが "apps" に残る）。
 * ラベルが重複すると、どちらが自分用でどちらが部署用か区別できなくなる。
 */
describe("featureRegistry のラベル", () => {
  test("サイドバーに並ぶラベルが重複しない", () => {
    const labels = featureRegistry.flatMap((feature) => feature.routes.map((route) => route.label))

    const seen = new Set<string>()
    const duplicated: Array<string> = []

    for (const label of labels) {
      if (seen.has(label)) duplicated.push(label)
      seen.add(label)
    }

    expect(duplicated).toEqual([])
  })

  test("本人と部署で同じ機能を指す項目は接頭辞で区別する", () => {
    // 本人側は素のラベル、部署側は「部署の〜」にする取り決め。
    const myLabels = new Set(
      featureRegistry.flatMap((feature) =>
        feature.routes.filter((route) => route.href.startsWith("/my/")).map((route) => route.label),
      ),
    )

    const teamLabels = featureRegistry.flatMap((feature) =>
      feature.routes.filter((route) => route.href.includes(":team")).map((route) => route.label),
    )

    const collided = teamLabels.filter((label) => myLabels.has(label))

    expect(collided).toEqual([])
  })

  test("すべての href が所有者を表す prefix を持つ", () => {
    const hrefs = featureRegistry.flatMap((feature) => feature.routes.map((route) => route.href))

    // ホーム、受信箱、通知、全社サマリはコンテキストを持たない composition。
    const compositionHrefs = new Set(["/", "/inbox", "/notifications", "/dashboards/management"])

    const scopePrefixes = ["/my/", "/teams/"]

    const invalid = hrefs.filter((href) => {
      if (compositionHrefs.has(href)) return false

      if (scopePrefixes.some((prefix) => href.startsWith(prefix))) return false

      return href.split("/").length < 3
    })

    expect(invalid).toEqual([])
  })
})
