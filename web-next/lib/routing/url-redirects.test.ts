import { existsSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vite-plus/test"
import { featureRegistry } from "@/lib/feature/feature-registry"
import { urlRedirects } from "@/lib/routing/url-redirects"

/**
 * Next の redirect source を照合用の正規表現にする。
 * `:name*` は残り全部、`:name` は 1 セグメント。
 */
function toSourcePattern(source: string): RegExp {
  const pattern = source
    .split("/")
    .map((segment) => {
      if (segment.endsWith("*") && segment.startsWith(":")) return "(?:.*)"

      if (segment.startsWith(":")) return "[^/]+"

      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    })
    .join("/")

  return new RegExp(`^${pattern}$`)
}

/**
 * 転送を 1 回だけ適用する。どの source にも当たらなければ null。
 */
function applyOnce(url: string): string | null {
  for (const redirect of urlRedirects) {
    const matched = url.match(toSourcePattern(redirect.source))

    if (matched === null) continue

    // `:path*` の捕捉分を行き先へ差し戻す。テストは前方一致の有無だけを見るので
    // 動的セグメントは残したまま返す。
    const rest = url.slice(redirect.source.replace(/\/:[^/]+\*?$/, "").length)

    if (redirect.destination.endsWith("/:path*")) {
      return redirect.destination.replace("/:path*", rest)
    }

    return redirect.destination
  }

  return null
}

const registryHrefs = featureRegistry.flatMap((feature) =>
  feature.routes.map((route) => route.href.replace(":team", "D001")),
)

describe("urlRedirects", () => {
  test("現行 URL がどの転送元にも食われない", () => {
    const eaten = registryHrefs
      .map((href) => ({ href, destination: applyOnce(href) }))
      .filter((entry) => entry.destination !== null)

    expect(eaten).toEqual([])
  })

  test("転送先が別の転送元へ落ちない（連鎖しない）", () => {
    const chained = urlRedirects
      .map((redirect) => ({
        source: redirect.source,
        destination: redirect.destination,
        next: applyOnce(redirect.destination.replace(/:[^/]+\*?/g, "x")),
      }))
      .filter((entry) => entry.next !== null)

    expect(chained).toEqual([])
  })

  test("基盤の旧URLと配下を現行URLへ転送する", () => {
    expect(applyOnce("/employees")).toBe("/company/employees")
    expect(applyOnce("/employees/E001")).toBe("/company/employees/E001")
    expect(applyOnce("/applications/inbox")).toBe("/inbox/applications")
    expect(applyOnce("/roles")).toBe("/system/roles")
  })

  test("本人スコープの配下は転送しない", () => {
    expect(applyOnce("/my/expenses")).toBe(null)
    expect(applyOnce("/my/leaves/new")).toBe(null)
  })

  test("転送元が重複しない", () => {
    const sources = urlRedirects.map((redirect) => redirect.source)

    const duplicated = sources.filter((source, index) => sources.indexOf(source) !== index)

    expect(duplicated).toEqual([])
  })
})

/**
 * href と物理ディレクトリの一致は規約では守れない。移動漏れは
 * 「そのルートを開かない」だけでテストが緑のまま通るため、検査で防ぐ。
 */
describe("feature-registry の href", () => {
  test("すべての href に page.tsx が実在する", () => {
    const missing = featureRegistry
      .flatMap((feature) => feature.routes.map((route) => route.href))
      .filter((href) => {
        const segments = href
          .split("/")
          .filter((segment) => segment !== "")
          .map((segment) => (segment.startsWith(":") ? `[${segment.slice(1)}]` : segment))

        return existsSync(path.join(appRoot, ...segments, "page.tsx")) === false
      })

    expect(missing).toEqual([])
  })

  test("ナビに出ない画面も転送元に食われない", () => {
    // registry の href だけを見る検査では、詳細・new・manage・export のような
    // 導線を持たない画面が redirect に食われても緑のまま通る。
    const eaten = toPageUrls(appRoot)
      .map((url) => ({ url, destination: applyOnce(url) }))
      .filter((entry) => entry.destination !== null)

    expect(eaten).toEqual([])
  })
})

const appRoot = path.join(import.meta.dirname, "..", "..", "app", "(app)")

/**
 * `app/(app)` 配下の page.tsx を URL に直す。
 * 動的 segment `[name]` は照合用に 1 セグメントの固定値へ置き換える。
 */
function toPageUrls(
  directory: string,
  segments: ReadonlyArray<string> = [],
): ReadonlyArray<string> {
  const urls: Array<string> = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === "page.tsx") {
      urls.push(`/${segments.join("/")}`)
      continue
    }

    if (entry.isDirectory() === false) continue
    if (entry.name.startsWith("_")) continue

    const segment = entry.name.startsWith("[") ? "x" : entry.name

    urls.push(...toPageUrls(path.join(directory, entry.name), [...segments, segment]))
  }

  return urls
}
