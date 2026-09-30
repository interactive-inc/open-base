import { systemWorkItemSchema } from "@/contexts/system/infrastructure/schema/system-work-item"
import { systemAttachmentSchema } from "@/contexts/system/infrastructure/schema/system-attachment"
import { systemCoreSchema } from "@/contexts/system/infrastructure/schema/system-core"
import { systemDeliverySchema } from "@/contexts/system/infrastructure/schema/system-delivery"
import { systemIntegrationSchema } from "@/contexts/system/infrastructure/schema/system-integration"
import { systemOperationReceiptSchema } from "@/contexts/system/infrastructure/schema/system-operation-receipt"
import { systemPrincipalSchema } from "@/contexts/system/infrastructure/schema/system-principal"
import { systemProcedureDelegationSchema } from "@/contexts/system/infrastructure/schema/system-procedure-delegation"
import { systemProcedureSchema } from "@/contexts/system/infrastructure/schema/system-procedure"
import { systemWorkflowSchema } from "@/contexts/system/infrastructure/schema/system-workflow"
import { companySchema as canonicalCompanySchema } from "@/contexts/company/infrastructure/schema/company"
import * as ownedSchema0 from "@/contexts/company/infrastructure/schema/employee"
import * as ownedSchema1 from "@/contexts/company/infrastructure/schema/employee-lifecycle"
import * as ownedSchema2 from "@/contexts/company/infrastructure/schema/organization"
import * as ownedSchema14 from "@/contexts/company/infrastructure/schema/audit"
import * as ownedSchema15 from "@/contexts/company/infrastructure/schema/personnel-annotation"

export const schema = {
  ...systemAttachmentSchema,
  ...systemCoreSchema,
  ...systemWorkItemSchema,
  ...systemDeliverySchema,
  ...systemIntegrationSchema,
  ...systemOperationReceiptSchema,
  ...systemPrincipalSchema,
  ...systemProcedureDelegationSchema,
  ...systemProcedureSchema,
  ...systemWorkflowSchema,
  ...canonicalCompanySchema,
  ...ownedSchema0,
  ...ownedSchema1,
  ...ownedSchema2,
  ...ownedSchema14,
  ...ownedSchema15,
}
