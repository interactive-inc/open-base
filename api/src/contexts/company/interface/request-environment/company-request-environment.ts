import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { SystemDatabase, SystemRequestAudit } from "@system/configuration/system-context"
import type { Context } from "hono"
import type { CompanyResourceWriteGuard } from "@/contexts/company/interface/ports/company-resource-write-guard"

export type CompanyHttpEnvironment = {
  Bindings: { DB?: D1Database; COMPANY_TIME_ZONE?: string; NOW?: string }
  Variables: {
    companyActor?: CompanyActorValue
    companyClock?: () => Date
    companyResourceWriteGuard?: CompanyResourceWriteGuard
    database: SystemDatabase
    auditContext: SystemRequestAudit
  }
}

export type CompanyHttpContext = Context<CompanyHttpEnvironment>
