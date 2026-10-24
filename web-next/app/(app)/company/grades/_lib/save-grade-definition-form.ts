import { revalidatePath } from "next/cache"
import { getMe } from "@/lib/api/get-me"
import { saveGradeDefinition } from "@/lib/api/save-grade-definition"
import { canManageGrades } from "@/lib/grade/can-manage-grades"
import { toGradeDefinitionCommand } from "@/app/(app)/company/grades/_lib/to-grade-definition-command"

/** 等級管理資格を検査し、確認済みの条件のまま改訂を送る。 */
export async function saveGradeDefinitionForm(
  formData: FormData,
  operation: "create" | "update" | "cancel",
) {
  const actor = await getMe()
  if (actor instanceof Error || !canManageGrades(actor.permissions))
    return { ok: false, error: "等級を管理する権限がありません" }
  const command = toGradeDefinitionCommand(formData, operation)
  if (command instanceof Error) return { ok: false, error: command.message }
  const receipt = await saveGradeDefinition(command)
  if (receipt instanceof Error) return { ok: false, error: receipt.message }
  revalidatePath("/company/grades")
  return { ok: true, error: null }
}
