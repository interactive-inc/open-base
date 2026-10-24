// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemAccountsAccountIdRoleBindingsRoute from "@system/interface/routes/system.accounts.$accountId.role-bindings"

export const GET = voidApiRoute(
  "GET",
  "/system/accounts/:accountId/role-bindings",
  systemAccountsAccountIdRoleBindingsRoute.GET,
)
export const POST = voidApiRoute(
  "POST",
  "/system/accounts/:accountId/role-bindings",
  systemAccountsAccountIdRoleBindingsRoute.POST,
)
