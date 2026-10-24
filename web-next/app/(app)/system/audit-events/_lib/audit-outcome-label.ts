import { labelOf } from "@/app/(app)/system/audit-events/_lib/label-of"

const outcomeLabels: Readonly<Record<string, string>> = {
  succeeded: "成功",
  denied: "拒否",
  failed: "失敗",
}

export function auditOutcomeLabel(value: string): string {
  return labelOf(outcomeLabels, value)
}
