import { resolveBaseUrl } from "@/lib/config/resolve-base-url"

/** 判断の画面がある対象。申請は番号、評価シートはUUIDで画面を開く。 */
export type DecisionKind = "application" | "review_sheet"

const pagePaths: Readonly<Record<DecisionKind, string>> = {
  application: "/decisions/applications",
  review_sheet: "/decisions/reviews",
}

/**
 * 承認・却下・差し戻しは人がブラウザーの判断の画面で行う。CLIは画面のURLを示すだけで判断を記録しない。
 * 画面はオリジン直下にあり、APIの `/api` は付けない。
 */
export function decisionPageUrl(kind: DecisionKind, id: string): URL {
  return new URL(`${pagePaths[kind]}/${encodeURIComponent(id)}`, resolveBaseUrl())
}

/** 判断の画面を案内する出力。1行目のURLだけを取り出して使えるようにする。 */
export function decisionPageGuide(kind: DecisionKind, id: string): string {
  return `${decisionPageUrl(kind, id).toString()}\nブラウザーで開いて判断してください。`
}
