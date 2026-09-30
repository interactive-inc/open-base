import { openSystemAttachmentObjects } from "@system/interface/operations/open-system-attachment-objects"
import { openSystemAttachments } from "@system/interface/operations/open-system-attachments"
import { UNLINKED_ATTACHMENT_RETENTION_MILLISECONDS } from "@system/domain/catalogs/attachments/unlinked-attachment-retention.catalog"
import { openSystemAttachmentDatabase } from "@system/interface/operations/open-system-attachment-database"
import type { Bindings } from "@/env"

/** 一回の定期起動で回収する上限。残りは次回の起動が拾う。 */
const PURGE_LIMIT = 100

/**
 * 紐付かないまま保持期限を過ぎた添付を、定期起動から掃除する。
 * `ATTACHMENT_PURGE_SCHEDULE_ENABLED="true"` と添付の保存先がある配備だけで動く。
 * 手順は `POST /system/attachments/purge-unlinked` と同じで、鍵の破棄と紐付けの禁止を
 * 本体の削除より先に確定し、失敗した行は消去済みのまま次回の起動で再試行する。
 */
export async function runScheduledAttachmentPurge(
  input: Readonly<{
    env: Pick<Bindings, "DB" | "ATTACHMENTS" | "ATTACHMENT_PURGE_SCHEDULE_ENABLED">
    clock: () => Date
  }>,
) {
  const enabled = input.env.ATTACHMENT_PURGE_SCHEDULE_ENABLED
  if (enabled === undefined || enabled === "" || enabled === "false") return []
  if (enabled !== "true") return new Error("attachment purge schedule configuration is invalid")
  if (input.env.ATTACHMENTS === undefined)
    return new Error("attachment purge schedule requires attachment storage")

  const now = input.clock()
  const threshold = new Date(now.getTime() - UNLINKED_ATTACHMENT_RETENTION_MILLISECONDS)
  const repository = openSystemAttachments({
    var: { database: openSystemAttachmentDatabase(input.env.DB) },
  })
  const store = openSystemAttachmentObjects({ env: { ATTACHMENTS: input.env.ATTACHMENTS } })

  const stale = await repository.listStaleUnlinked(threshold, PURGE_LIMIT, now)
  if (stale instanceof Error) return stale

  const purged: Array<string> = []
  for (const row of stale) {
    const claimed = await repository.claimUnlinkedPurge(row.id, threshold, now)
    if (claimed instanceof Error) return claimed
    if (claimed === null) continue
    const deleted = await store.delete(claimed.objectKey)
    if (deleted instanceof Error) return deleted
    const removed = await repository.deleteUnlinked(claimed.id)
    if (removed instanceof Error) return removed
    if (removed) purged.push(claimed.id)
  }

  return purged
}
