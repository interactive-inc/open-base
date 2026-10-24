import { labelOf } from "@/app/(app)/system/audit-events/_lib/label-of"

const reasonLabels: Readonly<Record<string, string>> = {
  permission_denied: "権限不足",
  invalid_credentials: "認証情報が無効",
  invalid_token: "トークンが無効",
  refresh_token_reuse: "更新トークンの再利用",
  audit_export_too_large: "出力サイズ超過",
}

export function auditReasonLabel(value: string | null): string {
  return labelOf(reasonLabels, value)
}
