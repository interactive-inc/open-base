// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemAccountsAccountIdRoleBindingsBindingIdRoute from "@system/interface/routes/system.accounts.$accountId.role-bindings.$bindingId"

export const DELETE = voidApiRoute(
  "DELETE",
  "/system/accounts/:accountId/role-bindings/:bindingId",
  systemAccountsAccountIdRoleBindingsBindingIdRoute.DELETE,
)
