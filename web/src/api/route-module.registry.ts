import { systemContextModule } from "@system/interface/module"
import { companyContextModule } from "@/contexts/company/interface/module"
import type { ApiRouteModuleRegistration } from "@/api/api-route-module"

export const ROUTE_MODULE_REGISTRY = [
  {
    ...systemContextModule,
    // 人のセッション発行は認証基盤へ統一する。別の資格交換経路から方式の設定を迂回させない。
    excludedRouteFiles: [
      "system.sessions.ts",
      "system.browser-login-codes.ts",
      "system.browser-sessions.ts",
      "system.cli-authorizations.ts",
      "system.cli-authorization-callback.ts",
      "system.cli-sessions.ts",
      "system.identity-sessions.ts",
      "system.oauth.mcp-grants.ts",
    ],
  },
  companyContextModule,
  {
    context: "api",
    tier: "composition",
    routesDirectory: "api/routes",
    routeImportPrefix: "@/api/routes",
  },
] satisfies ReadonlyArray<ApiRouteModuleRegistration>
