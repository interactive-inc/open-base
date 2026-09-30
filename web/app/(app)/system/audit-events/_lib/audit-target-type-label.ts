import { labelOf } from "@/app/(app)/system/audit-events/_lib/label-of"

const targetTypeLabels: Readonly<Record<string, string>> = {
  session: "セッション",
  role: "ロール",
  account: "アカウント",
  employee: "従業員",
  application_workflow: "承認フロー",
  application: "申請",
  approval_delegation: "承認委任",
  audit_event: "監査イベント",
  audit_export: "監査出力",
}

export function auditTargetTypeLabel(value: string | null): string {
  return labelOf(targetTypeLabels, value)
}
