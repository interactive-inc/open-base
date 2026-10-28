// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as performanceReviewSheetsIdHistoryRoute from "@/contexts/performance-review/interface/routes/performance-review.sheets.$id.history"

export const GET = voidApiRoute(
  "GET",
  "/performance-review/sheets/:id/history",
  performanceReviewSheetsIdHistoryRoute.GET,
)
