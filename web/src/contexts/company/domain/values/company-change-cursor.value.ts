import { z } from "zod"
import { companyResourceTypes } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"

const schema = z
  .strictObject({
    organizationId: z.string().min(1).max(255),
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    type: z.enum(companyResourceTypes).nullable(),
    id: z.string().min(1).max(255).nullable(),
    resourceRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  })
  .refine(
    (value) =>
      (value.type === null) === (value.id === null) &&
      (value.type === null) === (value.resourceRevision === null),
  )

/** 会社全体の読了位置と、同じ会社版を取得している途中の位置を区別する。 */
export class CompanyChangeCursorValue {
  private constructor(readonly props: Readonly<z.infer<typeof schema>>) {
    Object.freeze(this)
  }

  static restore(
    encoded: string | undefined,
    organizationId: string,
  ): CompanyChangeCursorValue | Error {
    try {
      const parsed = schema.safeParse(
        encoded === undefined
          ? { organizationId, revision: 0, type: null, id: null, resourceRevision: null }
          : JSON.parse(encoded),
      )
      if (!parsed.success) return parsed.error
      if (parsed.data.organizationId !== organizationId)
        return new Error("Company cursor organization mismatch")
      return new CompanyChangeCursorValue(Object.freeze(parsed.data))
    } catch (cause) {
      return new Error("Invalid Company change cursor", { cause })
    }
  }
}
