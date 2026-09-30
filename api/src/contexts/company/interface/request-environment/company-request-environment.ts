import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { SystemDatabase, SystemRequestAudit } from "@system/configuration/system-context"
import type { Context } from "hono"

export type CompanyHttpEnvironment = {
  Bindings: { DB?: D1Database; COMPANY_TIME_ZONE?: string; NOW?: string }
  Variables: {
    companyActor?: CompanyActorValue
    companyClock?: () => Date
    database: SystemDatabase
    auditContext: SystemRequestAudit
  }
}

export type CompanyHttpContext = Context<CompanyHttpEnvironment>
