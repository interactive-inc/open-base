const MESSAGES: Record<string, string> = {
  forbidden: "ロールを操作する権限がありません",
  managed_role: "システム定義のロールは変更・削除できません",
  role_conflict: "同じキーのロールが既に存在します",
  role_in_use: "割当中のロールは削除できません",
  role_not_found: "ロールが見つかりません",
  invalid_role: "ロールの内容が正しくありません",
  invalid_session: "セッションが無効です。ログインし直してください",
  iam_unavailable: "権限管理サービスが一時的に利用できません",
}

const FALLBACK = "保存に失敗しました。時間をおいて再度お試しください"

/** API の失敗 code をロール管理画面の日本語文言へ変換する。未知の code は共通文言にする。 */
export function toRoleActionErrorMessage(code: string | null): string {
  if (code === null) {
    return FALLBACK
  }

  return MESSAGES[code] ?? FALLBACK
}
