// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemAccountsAccountIdRoute from "@system/interface/routes/system.accounts.$accountId"

export const GET = voidApiRoute(
  "GET",
  "/system/accounts/:accountId",
  systemAccountsAccountIdRoute.GET,
)
export const PATCH = voidApiRoute(
  "PATCH",
  "/system/accounts/:accountId",
  systemAccountsAccountIdRoute.PATCH,
)
