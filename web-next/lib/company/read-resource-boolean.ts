import type { CompanyResource } from "@/lib/api/types/company-resource-types"

/**
 * resource の attributes から真偽値の属性を読む。値がないか真偽値でなければ null。
 */
export function readResourceBoolean(resource: CompanyResource, key: string): boolean | null {
  const value = resource.attributes[key]

  if (typeof value !== "boolean") return null

  return value
}
