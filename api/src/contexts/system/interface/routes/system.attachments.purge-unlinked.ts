import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { UNLINKED_ATTACHMENT_RETENTION_MILLISECONDS } from "@system/domain/catalogs/attachments/unlinked-attachment-retention.catalog"
import { SystemAttachmentError } from "@system/domain/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import {
  SystemAttachmentPurgeUnavailableError,
  SystemForbiddenError,
} from "@system/interface/errors"
import { systemFactory } from "@system/interface/request-environment/system-factory"

/**
 * 紐づかないまま期限を過ぎた添付を掃除する。既存のバッチ同様、実行は HTTP から起こす
 * （定期実行は運用側のスケジューラが叩く）。冪等なので複数回呼んでも安全。
 */
// @authorization permission - 本体を物理削除するため system:admin に限定する
export const POST = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin")) {
    throw new SystemForbiddenError()
  }
  if (context.env.ATTACHMENTS === undefined) {
    throw new SystemAttachmentPurgeUnavailableError(
      new SystemAttachmentError(
        "unavailable",
        "attachment_storage_unconfigured",
        "添付機能が設定されていません",
      ),
    )
  }

  const result = await (async () => {
    const command = {
      now: context.var.now(),
    }

    const threshold = new Date(command.now.getTime() - UNLINKED_ATTACHMENT_RETENTION_MILLISECONDS)

    const repository = new AttachmentAdapter(context)

    const stale = await repository.listStaleUnlinked(threshold, 100, command.now)

    if (stale instanceof Error) return stale

    const store = new AttachmentObjectAdapter(context)

    let purgedCount = 0

    for (const row of stale) {
      const claimed = await repository.claimUnlinkedPurge(row.id, threshold, command.now)

      if (claimed instanceof Error) return claimed
      if (claimed === null) continue

      const deleted = await store.delete(claimed.objectKey)

      if (deleted instanceof Error) return deleted

      const removed = await repository.deleteUnlinked(claimed.id)

      if (removed instanceof Error) return removed

      if (removed) purgedCount += 1
    }

    return { purgedCount }
  })()

  if (result instanceof Error) {
    throw new SystemAttachmentPurgeUnavailableError(result)
  }

  return context.json({ purged_count: result.purgedCount }, 200)
})
