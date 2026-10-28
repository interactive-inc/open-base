// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as performanceReviewCyclesRoute from "@/contexts/performance-review/interface/routes/performance-review.cycles"

export const GET = voidApiRoute(
  "GET",
  "/performance-review/cycles",
  performanceReviewCyclesRoute.GET,
)
export const POST = voidApiRoute(
  "POST",
  "/performance-review/cycles",
  performanceReviewCyclesRoute.POST,
)
