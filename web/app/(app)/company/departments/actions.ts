"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createOrgDepartment } from "@/lib/api/create-org-department"
import { deleteOrgDepartment } from "@/lib/api/delete-org-department"
import { getMe } from "@/lib/api/get-me"
import { updateOrgDepartment } from "@/lib/api/update-org-department"
import { canManageOrg } from "@/lib/org/can-manage-org"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type OrgDepartmentActionState = {
  ok: boolean
  error: string | null
}

/**
 * 組織単位作成 Server Action。code/name 必須、parent は任意。
 * 権限不足やコード重複は api がエラーを返す。成功時は一覧へ redirect する。
 */
export async function createOrgDepartmentAction(
  previousState: OrgDepartmentActionState,
  formData: FormData,
): Promise<OrgDepartmentActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageOrg(currentUser.permissions) === false) {
    return { ok: false, error: "組織を管理する権限がありません" }
  }

  const code = toText(formData.get("code"))

  if (code === null) {
    return { ok: false, error: "部署コードを入力してください" }
  }

  const name = toText(formData.get("name"))
  if (name === null) {
    return { ok: false, error: "部署名を入力してください" }
  }

  const created = await createOrgDepartment({
    code: code,
    name,
    parent_code: toText(formData.get("parent_code")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/company/departments")

  revalidatePath("/company/departments")

  // redirect() せず ok:true を返す。クライアント側で遷移を処理し、
  // 成功フィードバック（toast等）が握り潰されるのを防ぐ。
  return { ok: true, error: null }
}

/**
 * 組織単位変更 Server Action。code/name 必須、parent は任意。
 * 権限不足・不存在・自身を親にする変更は api がエラーを返す。成功時は /org を revalidate する。
 */
export async function updateOrgDepartmentAction(
  previousState: OrgDepartmentActionState,
  formData: FormData,
): Promise<OrgDepartmentActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageOrg(currentUser.permissions) === false) {
    return { ok: false, error: "組織を管理する権限がありません" }
  }

  const code = toText(formData.get("code"))

  if (code === null) {
    return { ok: false, error: "部署を特定できませんでした" }
  }

  const name = toText(formData.get("name"))
  if (name === null) {
    return { ok: false, error: "部署名を入力してください" }
  }

  const expectation = readExpectation(formData)
  if (expectation === null)
    return { ok: false, error: "一覧を再読み込みして部署を確認してください" }

  const updated = await updateOrgDepartment(code, {
    ...expectation,
    name,
    parent_code: toText(formData.get("parent_code")),
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/company/departments")

  return { ok: true, error: null }
}

/** 部署ノード削除 Server Action。code 必須。成功時は /org を revalidate する。 */
export async function deleteOrgDepartmentAction(
  previousState: OrgDepartmentActionState,
  formData: FormData,
): Promise<OrgDepartmentActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageOrg(currentUser.permissions) === false) {
    return { ok: false, error: "組織を管理する権限がありません" }
  }

  const code = toText(formData.get("code"))

  if (code === null) {
    return { ok: false, error: "部署を特定できませんでした" }
  }

  const expectation = readExpectation(formData)
  if (expectation === null)
    return { ok: false, error: "一覧を再読み込みして部署を確認してください" }

  const deleted = await deleteOrgDepartment(code, expectation)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/company/departments")

  return { ok: true, error: null }
}

/** FormData 値を文字列へ。未入力や空白のみは null。 */
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

/** フォームに表示した組織版を検証し、送信時の最新版で補完しない。 */
function readExpectation(formData: FormData) {
  const expectation = z
    .object({
      expected_organization_revision: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)),
      expected_as_of: z.string().date(),
    })
    .safeParse({
      expected_organization_revision: formData.get("expected_organization_revision"),
      expected_as_of: formData.get("expected_as_of"),
    })
  return expectation.success ? expectation.data : null
}
