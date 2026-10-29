import { UsageError } from "@/lib/errors"

/** 位置引数とflagが別の通知を指す場合は、対象を勝手に選ばず拒否する。 */
export function resolveNotificationId(
  positionalId: string | undefined,
  flagId: string | undefined,
): string {
  if (positionalId !== undefined && flagId !== undefined && positionalId !== flagId)
    throw new UsageError("位置引数のIDと --id は同じ通知を指定してください")

  const id = positionalId ?? flagId
  if (id === undefined || id === "") throw new UsageError("通知IDまたは --id が必要です")

  return id
}
