// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemRolesRoleIdRoute from "@system/interface/routes/system.roles.$roleId"

export const GET = voidApiRoute("GET", "/system/roles/:roleId", systemRolesRoleIdRoute.GET)
export const PATCH = voidApiRoute("PATCH", "/system/roles/:roleId", systemRolesRoleIdRoute.PATCH)
export const DELETE = voidApiRoute("DELETE", "/system/roles/:roleId", systemRolesRoleIdRoute.DELETE)
