// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemAccountsAccountIdIdentitiesIdentityIdRoute from "@system/interface/routes/system.accounts.$accountId.identities.$identityId"

export const GET = voidApiRoute(
  "GET",
  "/system/accounts/:accountId/identities/:identityId",
  systemAccountsAccountIdIdentitiesIdentityIdRoute.GET,
)
export const DELETE = voidApiRoute(
  "DELETE",
  "/system/accounts/:accountId/identities/:identityId",
  systemAccountsAccountIdIdentitiesIdentityIdRoute.DELETE,
)
