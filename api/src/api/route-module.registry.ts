import { systemContextModule } from "@system/interface/module"
import { companyContextModule } from "@/contexts/company/interface/module"
import type { ApiRouteModuleRegistration } from "@/api/api-route-module"

export const ROUTE_MODULE_REGISTRY = [
  systemContextModule,
  companyContextModule,
  {
    context: "api",
    tier: "composition",
    routesDirectory: "api/routes",
    routeImportPrefix: "@/api/routes",
  },
] satisfies ReadonlyArray<ApiRouteModuleRegistration>
