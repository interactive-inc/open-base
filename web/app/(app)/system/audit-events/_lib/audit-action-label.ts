import { labelOf } from "@/app/(app)/system/audit-events/_lib/label-of"

const actionLabels: Readonly<Record<string, string>> = {
  "auth.session.login_succeeded": "ログイン成功",
  "auth.session.login_denied": "ログイン拒否",
  "auth.session.refreshed": "セッション更新",
  "auth.session.reuse_detected": "更新トークン再利用検知",
  "iam.role.created": "ロール作成",
  "iam.role.updated": "ロール更新",
  "iam.role.deleted": "ロール削除",
  "iam.account.role_granted": "アカウントへのロール付与",
  "iam.account.role_revoked": "アカウントのロール解除",
  "iam.account.status_changed": "アカウント状態変更",
  "iam.account.password_reset": "パスワード再設定",
  "employee.account.registered": "従業員登録",
  "employee.account.retired": "従業員の退職",
  "employee.account.deleted": "従業員の削除",
  "application.workflow.updated": "承認フロー更新",
  "application.workflow.repaired": "承認フロー修復",
  "application.delegation.created": "承認委任作成",
  "application.delegation.cancelled": "承認委任取消",
  "application.decision.approved": "申請承認",
  "application.decision.rejected": "申請却下",
  "audit.event.searched": "監査ログ検索",
  "audit.event.read": "監査イベント閲覧",
  "audit.event.exported": "監査ログのCSV出力",
}

export function auditActionLabel(value: string): string {
  return labelOf(actionLabels, value)
}
