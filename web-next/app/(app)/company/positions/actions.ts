"use server"

import { savePositionDefinitionForm } from "@/app/(app)/company/positions/_lib/save-position-definition-form"

export type PositionActionState = { ok: boolean; error: string | null }

/** 確認した会社版へ新しい役職を登録する。 */
export async function createPositionAction(
  previousState: PositionActionState,
  formData: FormData,
): Promise<PositionActionState> {
  return savePositionDefinitionForm(formData, "create")
}

/** 確認した役職の次の改訂を保存する。 */
export async function updatePositionAction(
  previousState: PositionActionState,
  formData: FormData,
): Promise<PositionActionState> {
  return savePositionDefinitionForm(formData, "update")
}

/** 指定した日からの取消を履歴へ追記する。 */
export async function cancelPositionAction(
  previousState: PositionActionState,
  formData: FormData,
): Promise<PositionActionState> {
  return savePositionDefinitionForm(formData, "cancel")
}
