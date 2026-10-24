const MESSAGES: Record<string, string> = {
  forbidden: "ロールを操作する権限がありません。",
  managed_role: "標準ロールは変更・削除できません。",
  role_conflict: "同じキーのロールがすでにあります。",
  role_in_use: "アカウントに付与中のロールは削除できません。",
  role_not_found: "ロールが見つかりません。",
  invalid_role: "ロールの内容が正しくありません。",
  invalid_session: "セッションが無効です。ログインし直してください。",
  iam_unavailable: "権限の管理を一時的に利用できません。時間をおいてもう一度お試しください。",
}

const FALLBACK = "保存できませんでした。時間をおいてもう一度お試しください。"

/** API の失敗 code をロール管理画面の日本語文言へ変換する。未知の code は共通文言にする。 */
export function toRoleActionErrorMessage(code: string | null): string {
  if (code === null) {
    return FALLBACK
  }

  return MESSAGES[code] ?? FALLBACK
}
