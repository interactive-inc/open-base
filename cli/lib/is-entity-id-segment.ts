const ENTITY_ID_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/

/**
 * URL の path segment に埋め込む業務レコード ID かを判定する。
 * 整数 ID と UUID の両方を受け付け、`/` や `.` を含む値で別の path へ到達させない。
 * ID の形の正しさは API が判定する。
 */
export function isEntityIdSegment(value: string): boolean {
  return ENTITY_ID_SEGMENT.test(value)
}
