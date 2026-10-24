// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemPrincipalsPrincipalIdMachineCredentialsRoute from "@system/interface/routes/system.principals.$principalId.machine-credentials"

export const GET = voidApiRoute(
  "GET",
  "/system/principals/:principalId/machine-credentials",
  systemPrincipalsPrincipalIdMachineCredentialsRoute.GET,
)
export const POST = voidApiRoute(
  "POST",
  "/system/principals/:principalId/machine-credentials",
  systemPrincipalsPrincipalIdMachineCredentialsRoute.POST,
)
