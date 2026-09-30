import type { EmployeeLifecycleEventCursor } from "@/contexts/company/domain/definitions/decode-employee-lifecycle-event-cursor.definition"

export function encodeEmployeeLifecycleEventCursor(cursor: EmployeeLifecycleEventCursor): string {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}
