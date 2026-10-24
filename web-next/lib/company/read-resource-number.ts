import type { CompanyResource } from "@/lib/api/types/company-resource-types"

/**
 * resource の attributes から数値の属性を読む。値がないか数値でなければ null。
 */
export function readResourceNumber(resource: CompanyResource, key: string): number | null {
  const value = resource.attributes[key]

  if (typeof value !== "number") return null

  if (Number.isFinite(value) === false) return null

  return value
}
