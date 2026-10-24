// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyApprovalDelegationsIdRoute from "@/api/routes/company.approval-delegations.$id"

export const DELETE = voidApiRoute(
  "DELETE",
  "/company/approval-delegations/:id",
  companyApprovalDelegationsIdRoute.DELETE,
)
