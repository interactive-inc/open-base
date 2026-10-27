// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemAccountsAccountIdPasswordCredentialsRoute from "@system/interface/routes/system.accounts.$accountId.password-credentials"

export const PATCH = voidApiRoute(
  "PATCH",
  "/system/accounts/:accountId/password-credentials",
  systemAccountsAccountIdPasswordCredentialsRoute.PATCH,
)
