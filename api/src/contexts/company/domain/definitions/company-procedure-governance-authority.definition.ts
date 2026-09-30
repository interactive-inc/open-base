import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

export const zCompanyProcedureGovernanceAuthority = z.strictObject({
  organization_id: z.literal(COMPANY_DEFAULT_ORGANIZATION_ID),
  responsibility_code: z.string().trim().min(1).max(255),
  scope: z
    .discriminatedUnion("scope_type", [
      z.strictObject({
        scope_type: z.enum(["organization-unit", "legal-entity", "site", "workplace"]),
        scope_id: z.string().regex(/^\S{1,255}$/),
      }),
      z.strictObject({
        scope_type: z.literal("region"),
        region_code: z.string().trim().min(1).max(255),
      }),
      z.strictObject({
        scope_type: z.literal("amount"),
        currency_code: z.string().regex(/^[A-Z]{3}$/),
        amount_field: z.string().min(1).max(200),
      }),
    ])
    .nullable(),
})

export type CompanyProcedureGovernanceAuthority = z.infer<
  typeof zCompanyProcedureGovernanceAuthority
>
