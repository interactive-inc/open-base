import { revalidatePath } from "next/cache"
import { getMe } from "@/lib/api/get-me"
import { savePositionDefinition } from "@/lib/api/save-position-definition"
import { canManagePositions } from "@/lib/position/can-manage-positions"
import { toPositionDefinitionCommand } from "@/app/(app)/company/positions/_lib/to-position-definition-command"

/** 役職管理資格を検査し、確認済みの条件のまま改訂を送る。 */
export async function savePositionDefinitionForm(
  formData: FormData,
  operation: "create" | "update" | "cancel",
) {
  const actor = await getMe()
  if (actor instanceof Error || !canManagePositions(actor.permissions))
    return { ok: false, error: "役職を管理する権限がありません" }
  const command = toPositionDefinitionCommand(formData, operation)
  if (command instanceof Error) return { ok: false, error: command.message }
  const receipt = await savePositionDefinition(command)
  if (receipt instanceof Error) return { ok: false, error: receipt.message }
  revalidatePath("/company/positions")
  return { ok: true, error: null }
}
