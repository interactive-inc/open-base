// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyApplicationRequestsIdApproveRoute from "@/api/routes/company.application-requests.$id.approve"

export const POST = voidApiRoute(
  "POST",
  "/company/application-requests/:id/approve",
  companyApplicationRequestsIdApproveRoute.POST,
)
