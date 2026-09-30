"use server"

import { revalidatePath } from "next/cache"
import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"
import { createApplicationTemplate } from "@/lib/api/create-application-template"
import { deleteApplicationTemplate } from "@/lib/api/delete-application-template"
import { getMe } from "@/lib/api/get-me"
import { updateApplicationTemplate } from "@/lib/api/update-application-template"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type ApplicationTemplateFormState = {
  ok: boolean
  error: string | null
}

/** approver_roles はカンマ区切りのテキストから空要素を除いた配列にする。 */
function parseApproverRoles(value: FormDataEntryValue | null): ReadonlyArray<string> {
  const text = typeof value === "string" ? value : ""

  return text
    .split(",")
    .map((role) => role.trim())
    .filter((role) => role !== "")
}

/** schema_json は JSON テキストを解析する。空文字は空オブジェクト。解析失敗は Error。 */
function parseSchemaJson(value: FormDataEntryValue | null): unknown {
  const text = typeof value === "string" ? value.trim() : ""

  if (text === "") {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    return new Error("schema_json が不正な JSON です")
  }
}

/** テンプレート作成 Server Action（管理権限）。code/name/category 必須。 */
export async function createApplicationTemplateAction(
  _previousState: ApplicationTemplateFormState,
  formData: FormData,
): Promise<ApplicationTemplateFormState> {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    canManageApplicationTemplates(currentUser.permissions) === false
  ) {
    return { ok: false, error: "テンプレートを管理する権限がありません" }
  }

  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue.trim() : ""

  if (code === "") {
    return { ok: false, error: "コードを入力してください" }
  }

  const nameValue = formData.get("name")

  const name = typeof nameValue === "string" ? nameValue.trim() : ""

  if (name === "") {
    return { ok: false, error: "名称を入力してください" }
  }

  const categoryValue = formData.get("category")

  const category = typeof categoryValue === "string" ? categoryValue.trim() : ""

  if (category === "") {
    return { ok: false, error: "カテゴリを入力してください" }
  }

  const descriptionValue = formData.get("description")

  const description =
    typeof descriptionValue === "string" && descriptionValue.trim() !== ""
      ? descriptionValue.trim()
      : null

  const schemaJson = parseSchemaJson(formData.get("schema_json"))

  if (schemaJson instanceof Error) {
    return { ok: false, error: schemaJson.message }
  }

  const created = await createApplicationTemplate({
    code: code,
    name: name,
    category: category,
    description: description,
    schema_json: schemaJson,
    approver_roles: parseApproverRoles(formData.get("approver_roles")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/system/application-templates")

  return { ok: true, error: null }
}

/** テンプレート変更 Server Action（管理権限）。code は hidden input、内容は各 input で受け取る。 */
export async function updateApplicationTemplateAction(
  _previousState: ApplicationTemplateFormState,
  formData: FormData,
): Promise<ApplicationTemplateFormState> {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    canManageApplicationTemplates(currentUser.permissions) === false
  ) {
    return { ok: false, error: "テンプレートを管理する権限がありません" }
  }

  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue.trim() : ""

  if (code === "") {
    return { ok: false, error: "テンプレートが不明です" }
  }

  const nameValue = formData.get("name")

  const name = typeof nameValue === "string" ? nameValue.trim() : ""

  if (name === "") {
    return { ok: false, error: "名称を入力してください" }
  }

  const categoryValue = formData.get("category")

  const category = typeof categoryValue === "string" ? categoryValue.trim() : ""

  if (category === "") {
    return { ok: false, error: "カテゴリを入力してください" }
  }

  const descriptionValue = formData.get("description")

  const description =
    typeof descriptionValue === "string" && descriptionValue.trim() !== ""
      ? descriptionValue.trim()
      : null

  const schemaJson = parseSchemaJson(formData.get("schema_json"))

  if (schemaJson instanceof Error) {
    return { ok: false, error: schemaJson.message }
  }

  const updated = await updateApplicationTemplate(code, {
    name: name,
    category: category,
    description: description,
    schema_json: schemaJson,
    approver_roles: parseApproverRoles(formData.get("approver_roles")),
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/system/application-templates")

  return { ok: true, error: null }
}

/** テンプレート削除 Server Action（管理権限）。code を hidden input で受け取る。 */
export async function deleteApplicationTemplateAction(
  _previousState: ApplicationTemplateFormState,
  formData: FormData,
): Promise<ApplicationTemplateFormState> {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    canManageApplicationTemplates(currentUser.permissions) === false
  ) {
    return { ok: false, error: "テンプレートを管理する権限がありません" }
  }

  const codeValue = formData.get("code")

  const code = typeof codeValue === "string" ? codeValue.trim() : ""

  if (code === "") {
    return { ok: false, error: "テンプレートが不明です" }
  }

  const deleted = await deleteApplicationTemplate(code)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/system/application-templates")

  return { ok: true, error: null }
}
