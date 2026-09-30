"use server"

import { revalidatePath } from "next/cache"
import { toRoleActionErrorMessage } from "@/app/(app)/system/roles/_lib/to-role-action-error-message"
import { ApiResponseError } from "@/lib/api/api-response-error"
import { createRole } from "@/lib/api/create-role"
import { deleteRole } from "@/lib/api/delete-role"
import { getMe } from "@/lib/api/get-me"
import { updateRole } from "@/lib/api/update-role"
import { getStepUpToken } from "@/lib/auth/get-step-up-token"
import { canManageRoles } from "@/lib/iam/can-manage-roles"

/**
 * ロール操作の結果。`step_up_required` は拒否ではなく、パスワード再入力を挟めば
 * 同じ操作を再実行できることを表す。画面はこれを見て再認証ダイアログを開く。
 */
export type RoleActionState =
  | { kind: "idle" }
  | { kind: "succeeded" }
  | { kind: "step_up_required" }
  | { kind: "failed"; error: string }

export type RoleCreateFormState = RoleActionState

export type RoleUpdateFormState = RoleActionState

export type RoleDeleteFormState = RoleActionState

/** FormData からロール更新を実行するサーバーアクション。iam:write 権限と再認証 grant が必要。 */
export async function updateRoleAction(
  _previousState: RoleUpdateFormState,
  formData: FormData,
): Promise<RoleUpdateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRoles(currentUser.permissions) === false) {
    return { kind: "failed", error: "ロールを管理する権限がありません" }
  }

  const roleId = toRoleId(formData.get("role_id"))

  const name = toRoleText(formData.get("name"))

  if (roleId === null || name === null) {
    return { kind: "failed", error: "ロールと名前は必須です" }
  }

  const description = toRoleText(formData.get("description"))

  const permissionKeys = toPermissionKeys(formData)

  const stepUpToken = await getStepUpToken()

  const updated = await updateRole(roleId, {
    name: name,
    description: description,
    permissionKeys: permissionKeys,
    stepUpToken: stepUpToken,
  })

  if (updated instanceof Error) {
    return toFailedState(updated)
  }

  revalidatePath("/system/roles")

  // redirect() せず成功を返す。クライアント側で遷移を処理し、
  // 成功フィードバック（toast等）が握り潰されるのを防ぐ。
  return { kind: "succeeded" }
}

/** custom role を削除する。iam:write 権限と再認証 grant が必要。 */
export async function deleteRoleAction(
  _previousState: RoleDeleteFormState,
  formData: FormData,
): Promise<RoleDeleteFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRoles(currentUser.permissions) === false) {
    return { kind: "failed", error: "ロールを管理する権限がありません" }
  }

  const roleId = toRoleId(formData.get("role_id"))

  if (roleId === null) {
    return { kind: "failed", error: "ロールを指定してください" }
  }

  const stepUpToken = await getStepUpToken()

  const deleted = await deleteRole(roleId, stepUpToken)

  if (deleted instanceof Error) {
    return toFailedState(deleted)
  }

  revalidatePath("/system/roles")

  return { kind: "succeeded" }
}

/**
 * FormData からロール作成を実行するサーバーアクション。iam:write 権限と再認証 grant が必要。
 * permission_keys は同名の複数チェックボックスから配列で受け取る。
 */
export async function createRoleAction(
  _previousState: RoleCreateFormState,
  formData: FormData,
): Promise<RoleCreateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRoles(currentUser.permissions) === false) {
    return { kind: "failed", error: "ロールを管理する権限がありません" }
  }

  const key = toRoleText(formData.get("key"))

  const name = toRoleText(formData.get("name"))

  if (key === null || name === null) {
    return { kind: "failed", error: "キーと名前は必須です" }
  }

  const description = toRoleText(formData.get("description"))

  const permissionKeys = toPermissionKeys(formData)

  const stepUpToken = await getStepUpToken()

  const created = await createRole({
    key: key,
    name: name,
    description: description,
    permissionKeys: permissionKeys,
    stepUpToken: stepUpToken,
  })

  if (created instanceof Error) {
    return toFailedState(created)
  }

  revalidatePath("/system/roles")

  return { kind: "succeeded" }
}

/**
 * API の失敗を画面の状態へ変換する。`step_up_required` は 403 だが `forbidden` と意味が違うため、
 * status ではなく code だけで判別する。
 */
function toFailedState(error: Error): RoleActionState {
  if (error instanceof ApiResponseError === false) {
    return { kind: "failed", error: toRoleActionErrorMessage(null) }
  }

  if (error.code === "step_up_required") {
    return { kind: "step_up_required" }
  }

  return { kind: "failed", error: toRoleActionErrorMessage(error.code) }
}

function toRoleId(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null
  }

  if (value.length < 1 || value.length > 255) {
    return null
  }

  return value
}

/** 空文字・非文字列を null に潰した文字列を返す。 */
function toRoleText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  if (trimmed === "") {
    return null
  }

  return trimmed
}

function toPermissionKeys(formData: FormData): ReadonlyArray<string> {
  return formData
    .getAll("permission_keys")
    .filter((value): value is string => typeof value === "string")
}
