import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"

/** 公開済みの論理通知を、再送や保存経路の移行前に判定する。 */
export async function listExistingSystemNotificationPublicationKeys(
  input: Readonly<{ database: D1Database; publicationKeys: ReadonlyArray<string> }>,
): Promise<ReadonlySet<string> | Error> {
  return new SystemNotificationRepository({
    context: { env: { DB: input.database } },
  }).listExistingPublicationKeys(input.publicationKeys)
}
