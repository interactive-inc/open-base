// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as performanceReviewSheetsRoute from "@/contexts/performance-review/interface/routes/performance-review.sheets"

export const GET = voidApiRoute(
  "GET",
  "/performance-review/sheets",
  performanceReviewSheetsRoute.GET,
)
export const POST = voidApiRoute(
  "POST",
  "/performance-review/sheets",
  performanceReviewSheetsRoute.POST,
)
