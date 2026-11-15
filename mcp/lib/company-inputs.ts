import { z } from "zod"
import { companyResourceTypes } from "../../web/src/contexts/company/domain/catalogs/company-resource-type.catalog"
import { evidenceReference, numericText } from "@/lib/tool-inputs"

const identifier = z.string().regex(/^\S{1,255}$/)

/** Company正本の一覧に共通する問い合わせ。`id` は繰り返しで送る。 */
export const companyListQuery = {
  id: z.union([identifier, z.array(identifier).max(100)]).optional(),
  organization_revision: numericText.optional(),
  effective_on: z.iso.date().optional(),
  as_of: z.iso.date().optional(),
}

/** Company の資源の種類。 */
export const companyResourceType = z.enum(companyResourceTypes)

/**
 * Company正本の一版。属性は種類ごとにAPIが厳格に検証するため、ここでは外形だけを絞る。
 * 属性の名前はcamelCaseで、読んだ版をそのまま直して送る。
 */
export function companyResource<const Types extends readonly [string, ...string[]]>(types: Types) {
  return z.strictObject({
    organizationId: identifier,
    type: z.enum(types),
    id: identifier,
    revision: z.number().int().min(1),
    state: z.enum(["active", "void"]),
    effectiveFrom: z.iso.date(),
    effectiveTo: z.iso.date().nullable(),
    attributes: z.record(z.string(), z.unknown()),
  })
}

/** 版の訂正。前の版を指して、新しい版で置き換える。 */
export const companyCorrection = z.strictObject({
  type: companyResourceType,
  id: identifier,
  revision: z.number().int().min(2),
  correctsRevision: z.number().int().min(1),
})

/** 出典の参照の一覧。 */
export const evidenceReferences = z.array(evidenceReference).max(100)

/** Company の一覧は `id` を繰り返しの問い合わせで受ける。 */
export function withIds(path: string, ids: string | string[] | undefined): string {
  if (ids === undefined) return path
  const search = new URLSearchParams()
  for (const id of Array.isArray(ids) ? ids : [ids]) search.append("id", id)
  return `${path}?${search.toString()}`
}
