import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  SystemNotificationRepository,
  type SystemNotificationRecord,
} from "@system/infrastructure/repositories/notifications/system-notification.repository"

/** 受信Accountの通知を、旧形式を含めて読み取る公開契約。 */
export async function listSystemNotificationRecords(
  input: Readonly<{
    database: D1Database
    recipientAccountId: AccountId
    read?: boolean
    deliveryId?: string
  }>,
): Promise<ReadonlyArray<SystemNotificationRecord> | Error> {
  return new SystemNotificationRepository({
    context: { env: { DB: input.database } },
  }).listRecordsForAccount(input.recipientAccountId, input.read ?? null, input.deliveryId ?? null)
}
