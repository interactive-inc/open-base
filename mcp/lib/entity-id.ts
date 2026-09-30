import { z } from "zod"

/**
 * URL の path segment に埋め込む業務レコード ID。整数 ID と UUID の両方を受け付け、
 * `/` や `.` を含む値で別の path へ到達させない。ID の形の正しさは API が判定する。
 */
export const entityIdSegment = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/)

/**
 * JSON body に載せる業務レコード ID。API は現在整数 ID を返すが、UUID 移行後は文字列になるため
 * 文字列と整数の両方を受け付け、API へ送る直前に変換する。
 */
export const entityIdInput = z.union([z.string().min(1).max(128), z.number().int().positive()])

/** API の入力 schema が文字列 ID を受け取る項目へ送るときの変換。 */
export function toApiStringId(value: string | number): string
export function toApiStringId(value: string | number | undefined): string | undefined
export function toApiStringId(value: string | number | undefined): string | undefined {
  return value === undefined ? undefined : String(value)
}
