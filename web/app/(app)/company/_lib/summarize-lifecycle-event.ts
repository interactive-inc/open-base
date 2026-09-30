function stringOrNone(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : "なし"
}

export function summarizeLifecycleEvent(summary: unknown): ReadonlyArray<string> {
  if (summary === null || typeof summary !== "object" || Array.isArray(summary)) return []
  const value = summary as Record<string, unknown>
  const department = value.department
  const parts: string[] = []
  if (department !== null && typeof department === "object" && !Array.isArray(department)) {
    const data = department as Record<string, unknown>
    if (typeof data.name === "string") parts.push(`部署: ${data.name}`)
  }
  if (typeof value.previousPositionTitle === "string") {
    parts.push(`役職: ${value.previousPositionTitle} → ${stringOrNone(value.positionTitle)}`)
  } else if (typeof value.positionTitle === "string") {
    parts.push(`役職: ${value.positionTitle}`)
  }
  if ("previousManagerEmployeeCode" in value) {
    parts.push(
      `上司: ${stringOrNone(value.previousManagerEmployeeCode)} → ${stringOrNone(value.managerEmployeeCode)}`,
    )
  } else if (typeof value.managerEmployeeCode === "string") {
    parts.push(`上司: ${value.managerEmployeeCode}`)
  }
  if (typeof value.status === "string") parts.push(`状態: ${value.status}`)
  return parts
}
