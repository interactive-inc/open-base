import type * as systemAttachmentSchema from "@system/infrastructure/schema/system-attachment"
import type * as systemCoreSchema from "@system/infrastructure/schema/system-core"
import type * as systemProcedureSchema from "@system/infrastructure/schema/system-procedure"
import type * as systemProcedureDelegationSchema from "@system/infrastructure/schema/system-procedure-delegation"
import type * as systemRelationsSchema from "@system/infrastructure/schema/system-relations"
import type * as systemWorkflowSchema from "@system/infrastructure/schema/system-workflow"
import type * as companyCoreSchema from "@/contexts/company/infrastructure/schema/company"
import type * as employeeSchema from "@/contexts/company/infrastructure/schema/employee"
import type * as employmentSchema from "@/contexts/company/infrastructure/schema/employment"
import type * as organizationSchema from "@/contexts/company/infrastructure/schema/organization"
import type * as companyRelationsSchema from "@/contexts/company/infrastructure/schema/company-relations"
import type { DrizzleD1Database } from "drizzle-orm/d1"

/** Companyが所有する正本と、直接依存するportableなSystem schemaの完全な合成型。 */
export type CompanyDatabaseSchema = typeof systemAttachmentSchema &
  typeof systemCoreSchema &
  typeof systemProcedureSchema &
  typeof systemProcedureDelegationSchema &
  typeof systemRelationsSchema &
  typeof systemWorkflowSchema &
  typeof companyCoreSchema &
  typeof employeeSchema &
  typeof employmentSchema &
  typeof organizationSchema &
  typeof companyRelationsSchema

export type CompanyDatabase = DrizzleD1Database<CompanyDatabaseSchema>
