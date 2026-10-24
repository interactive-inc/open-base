import type { CompanyResource } from "@/lib/api/types/company-resource-types"

/**
 * resource の attributes から文字列の属性を読む。
 * 生成型の attributes は Record<string, unknown> で型安全がないため、
 * `as` を使わず typeof 検査で絞り込む。値がなければ null。
 */
export function readResourceText(resource: CompanyResource, key: string): string | null {
  const value = resource.attributes[key]

  if (typeof value !== "string") return null

  if (value.length === 0) return null

  return value
}
