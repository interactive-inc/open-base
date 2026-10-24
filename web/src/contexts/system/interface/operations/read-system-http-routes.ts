import {
  systemAuditedRoutes,
  systemAuthenticatedRoutes,
  systemPreDatabaseRoutes,
  systemPublicRoutes,
} from "@system/interface/routes/system"

/** composition rootへ認証phaseごとのHTTP経路を提供する。 */
export function readSystemHttpRoutes() {
  return {
    systemAuditedRoutes,
    systemAuthenticatedRoutes,
    systemPreDatabaseRoutes,
    systemPublicRoutes,
  }
}
