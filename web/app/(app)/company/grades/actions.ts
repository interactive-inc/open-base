"use server"

import { saveGradeDefinitionForm } from "@/app/(app)/company/grades/_lib/save-grade-definition-form"

export type GradeActionState = { ok: boolean; error: string | null }

/** 確認した会社版へ新しい等級を登録する。 */
export async function createGradeAction(
  previousState: GradeActionState,
  formData: FormData,
): Promise<GradeActionState> {
  return saveGradeDefinitionForm(formData, "create")
}

/** 確認した等級の次の改訂を保存する。 */
export async function updateGradeAction(
  previousState: GradeActionState,
  formData: FormData,
): Promise<GradeActionState> {
  return saveGradeDefinitionForm(formData, "update")
}

/** 指定した日からの取消を履歴へ追記する。 */
export async function cancelGradeAction(
  previousState: GradeActionState,
  formData: FormData,
): Promise<GradeActionState> {
  return saveGradeDefinitionForm(formData, "cancel")
}
