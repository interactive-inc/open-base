// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyPersonalDataErasureRequestsIdExecuteRoute from "@/api/routes/company.personal-data-erasure-requests.$id.execute"

export const POST = voidApiRoute(
  "POST",
  "/company/personal-data-erasure-requests/:id/execute",
  companyPersonalDataErasureRequestsIdExecuteRoute.POST,
)
