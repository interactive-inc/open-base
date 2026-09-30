"use server"

import { revalidatePath } from "next/cache"
import { ApiResponseError } from "@/lib/api/api-response-error"
import { getMe } from "@/lib/api/get-me"
import { grantAccountRole } from "@/lib/api/grant-account-role"
import { resetAccountPassword } from "@/lib/api/reset-account-password"
import { revokeAccountRole } from "@/lib/api/revoke-account-role"
import { setAccountStatus } from "@/lib/api/set-account-status"
import { getStepUpToken } from "@/lib/auth/get-step-up-token"
import { canAssignRoles } from "@/lib/iam/can-assign-roles"
import { canManageAccounts } from "@/lib/iam/can-manage-accounts"

/**
 * アカウント操作の結果。`step_up_required` は拒否ではなく、パスワード再入力を挟めば
 * 同じ操作を再実行できることを表す。画面はこれを見て再認証ダイアログを開く。
 */
export type AccountActionState =
  | { kind: "idle" }
  | { kind: "succeeded" }
  | { kind: "step_up_required" }
  | { kind: "failed"; error: string }

/**
 * API の失敗を画面の状態へ変換する。`step_up_required` は 403 だが `forbidden` と意味が違うため、
 * status ではなく code だけで判別する。
 * それ以外の code は、そのアクションの文脈に合った日本語文言へ変換する。
 * 同じ code でもアクションによって意味が変わる（last_admin は剥奪では「外せません」、
 * 停止では「停止できません」）ため、マップはアクションごとに分ける。
 * 未知の code や code の無い応答は fallback を返す。
 */
function toFailedState(
  error: Error,
  messages: Record<string, string>,
  fallback: string,
): AccountActionState {
  if (error instanceof ApiResponseError && error.code === "step_up_required") {
    return { kind: "step_up_required" }
  }

  if (error instanceof ApiResponseError && error.code !== null) {
    const mapped = messages[error.code]

    if (mapped !== undefined) {
      return { kind: "failed", error: mapped }
    }
  }

  return { kind: "failed", error: fallback }
}

/** アカウントから Role Binding を剥奪する。iam:write 権限と再認証 grant が必要。 */
export async function revokeAccountRoleAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canAssignRoles(currentUser.permissions) === false) {
    return { kind: "failed", error: "ロールを管理する権限がありません" }
  }

  const accountId = toOpaqueAccountId(formData.get("account_id"))

  const bindingId = toOpaqueAccountId(formData.get("binding_id"))

  if (accountId === null || bindingId === null) {
    return { kind: "failed", error: "アカウントとロールを指定してください" }
  }

  const stepUpToken = await getStepUpToken()

  const revoked = await revokeAccountRole(accountId, bindingId, stepUpToken)

  if (revoked instanceof Error) {
    return toFailedState(
      revoked,
      {
        last_admin: "最後の管理者はロールを外せません",
        role_escalation: "自分より強い権限のロールは外せません",
        role_not_found: "指定したロールが見つかりません",
        forbidden: "ロールを管理する権限がありません",
        invalid_session: "セッションが無効です。ログインし直してください",
      },
      "ロールの剥奪に失敗しました",
    )
  }

  revalidatePath("/system/accounts")

  return { kind: "succeeded" }
}

/** 管理者がアカウントのパスワードを再設定する。iam:write 権限と再認証 grant が必要。 */
export async function resetPasswordAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAccounts(currentUser.permissions) === false) {
    return { kind: "failed", error: "アカウントを管理する権限がありません" }
  }

  const accountId = toOpaqueAccountId(formData.get("account_id"))

  const newPassword = toText(formData.get("new_password"))

  if (accountId === null || newPassword === null) {
    return { kind: "failed", error: "アカウントとパスワードを指定してください" }
  }

  if (newPassword.length < 12) {
    return { kind: "failed", error: "パスワードは12文字以上にしてください" }
  }

  const stepUpToken = await getStepUpToken()

  const reset = await resetAccountPassword(accountId, newPassword, stepUpToken)

  if (reset instanceof Error) {
    return toFailedState(
      reset,
      {
        weak_password: "パスワードは12文字以上にしてください",
        role_escalation: "自分より強い権限のアカウントは変更できません",
        account_not_found: "対象のアカウントが見つかりません",
        identity_not_found: "このアカウントにはパスワードが設定されていません",
        forbidden: "アカウントを管理する権限がありません",
        invalid_session: "セッションが無効です。ログインし直してください",
      },
      "パスワードの再設定に失敗しました",
    )
  }

  revalidatePath("/system/accounts")

  return { kind: "succeeded" }
}

/** アカウントの状態を変更する（停止・有効化）。iam:write 権限と再認証 grant が必要。 */
export async function setAccountStatusAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAccounts(currentUser.permissions) === false) {
    return { kind: "failed", error: "アカウントを管理する権限がありません" }
  }

  const accountId = toOpaqueAccountId(formData.get("account_id"))

  const status = toStatus(formData.get("status"))

  if (accountId === null || status === null) {
    return { kind: "failed", error: "アカウントと状態を指定してください" }
  }

  const stepUpToken = await getStepUpToken()

  const updated = await setAccountStatus(accountId, status, stepUpToken)

  if (updated instanceof Error) {
    return toFailedState(
      updated,
      {
        self_deactivation: "自分自身は停止できません",
        last_admin: "最後の管理者は停止できません",
        role_escalation: "自分より強い権限のアカウントは変更できません",
        account_not_found: "対象のアカウントが見つかりません",
        invalid_status: "指定した状態が不正です",
        forbidden: "アカウントを管理する権限がありません",
        invalid_session: "セッションが無効です。ログインし直してください",
      },
      "状態の変更に失敗しました",
    )
  }

  revalidatePath("/system/accounts")

  return { kind: "succeeded" }
}

function toStatus(value: FormDataEntryValue | null): "active" | "suspended" | "locked" | null {
  if (value === "active" || value === "suspended" || value === "locked") {
    return value
  }

  return null
}

/** FormData からアカウントへの Role Binding 作成を実行する。iam:write 権限と再認証 grant が必要。 */
export async function grantAccountRoleAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canAssignRoles(currentUser.permissions) === false) {
    return { kind: "failed", error: "ロールを管理する権限がありません" }
  }

  const accountId = toOpaqueAccountId(formData.get("account_id"))

  const roleId = toOpaqueAccountId(formData.get("role_id"))

  if (accountId === null || roleId === null) {
    return { kind: "failed", error: "アカウントとロールを指定してください" }
  }

  const stepUpToken = await getStepUpToken()

  const granted = await grantAccountRole(accountId, roleId, stepUpToken)

  if (granted instanceof Error) {
    return toFailedState(
      granted,
      {
        self_assignment: "自分自身にはロールを付与できません",
        role_escalation: "自分が持たない権限を含むロールは付与できません",
        role_not_found: "指定したロールが見つかりません",
        account_not_found: "対象のアカウントが見つかりません",
        forbidden: "ロールを管理する権限がありません",
        invalid_session: "セッションが無効です。ログインし直してください",
      },
      "ロールの付与に失敗しました",
    )
  }

  revalidatePath("/system/accounts")

  return { kind: "succeeded" }
}

function toOpaqueAccountId(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.length >= 1 && value.length <= 255 ? value : null
}

function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return trimmed === "" ? null : trimmed
}
