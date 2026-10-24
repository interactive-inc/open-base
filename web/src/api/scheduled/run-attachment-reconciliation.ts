import { reconcileSystemAttachmentObjects } from "@system/interface/operations/reconcile-system-attachment-objects"
import type { Bindings } from "@/env"

/** 一回の定期起動で確認する添付の量。残りはSystemに記録した位置から次回の起動が続ける。 */
const RECONCILIATION_LIMITS = { chunkSize: 100, maxChunks: 10 } as const

/**
 * 添付本体の実在照合を定期起動から実行する。
 * `ATTACHMENT_RECONCILE_SCHEDULE_ENABLED="true"` と添付の保存先がある配備だけで動く。
 * 位置と結果はSystem batch job、欠損と失敗はSystem通知へ記録する。
 */
export async function runScheduledAttachmentReconciliation(
  input: Readonly<{
    env: Pick<Bindings, "DB" | "ATTACHMENTS" | "ATTACHMENT_RECONCILE_SCHEDULE_ENABLED">
    clock: () => Date
  }>,
) {
  const enabled = input.env.ATTACHMENT_RECONCILE_SCHEDULE_ENABLED
  if (enabled === undefined || enabled === "" || enabled === "false") return []
  if (enabled !== "true")
    return new Error("attachment reconciliation schedule configuration is invalid")

  const outcome = await reconcileSystemAttachmentObjects(
    { env: { DB: input.env.DB, ATTACHMENTS: input.env.ATTACHMENTS }, clock: input.clock },
    RECONCILIATION_LIMITS,
  )
  if (outcome instanceof Error) return outcome
  return [outcome]
}
