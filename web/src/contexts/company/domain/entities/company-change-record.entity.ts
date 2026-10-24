import { z } from "zod"
import { companyResourceTypes } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"

const evidenceReferenceSchema = z.strictObject({
  context: z.string().min(1).max(100),
  kind: z.string().min(1).max(100),
  id: z.string().min(1).max(512),
  version: z.string().min(1).max(255),
})

const schema = z.object({
  organization_revision: z.number().int().positive(),
  resource_type: z.enum(companyResourceTypes),
  resource_id: z.string().min(1),
  revision: z.number().int().positive(),
  command_id: z.string().min(1),
  actor_account_id: z.string().min(1),
  reason: z.string().min(1),
  evidence_references: z.array(evidenceReferenceSchema),
  corrects_revision: z.number().int().positive().nullable(),
  state: z.enum(["active", "void"]),
  effective_from: z.string().date(),
  effective_to: z.string().date().nullable(),
  recorded_at: z.number().int().nonnegative(),
})

/** 公開資源の確定した変更位置と有効期間。資源の属性や実行許可は含めない。 */
export class CompanyChangeRecordEntity {
  private constructor(readonly props: Readonly<z.infer<typeof schema>>) {
    Object.freeze(this)
  }

  static restore(value: unknown): CompanyChangeRecordEntity | Error {
    const row = z.object({ evidence_references_json: z.string() }).safeParse(value)
    if (!row.success) return row.error
    let evidenceReferences: unknown
    try {
      evidenceReferences = JSON.parse(row.data.evidence_references_json)
    } catch {
      return new Error("invalid Company evidence references")
    }
    const parsed = schema.safeParse({
      ...(value as object),
      evidence_references: evidenceReferences,
    })
    if (!parsed.success) return parsed.error
    return new CompanyChangeRecordEntity(Object.freeze(parsed.data))
  }
}
