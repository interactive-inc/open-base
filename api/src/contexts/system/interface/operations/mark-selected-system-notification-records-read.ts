import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"

/** 呼び出し側が可視性を確認したAccount deliveryだけを既読にする公開契約。 */
export async function markSelectedSystemNotificationRecordsRead(
  input: Readonly<{
    database: D1Database
    recipientAccountId: AccountId
    deliveryIds: ReadonlyArray<string>
    readAt: Date
  }>,
): Promise<number | Error> {
  return new SystemNotificationRepository({
    context: { env: { DB: input.database } },
  }).markSelectedRecordsRead(input)
}
