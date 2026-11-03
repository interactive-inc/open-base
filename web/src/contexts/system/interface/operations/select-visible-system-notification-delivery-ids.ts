import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemNotificationReferenceAdapter } from "@system/infrastructure/adapters/notifications/system-notification-reference.adapter"
import type { SystemNotificationVisibility } from "@system/interface/ports/system-notification-visibility"
import { drizzle } from "drizzle-orm/d1"

/** nullは追加制限なし。可視性はページ分割や集計より前に解決する。 */
export async function selectVisibleSystemNotificationDeliveryIds(
  input: Readonly<{
    database: D1Database
    recipientAccountId: AccountId
    visibility: SystemNotificationVisibility | undefined
    read?: boolean
    deliveryId?: string
  }>,
): Promise<ReadonlyArray<string> | null | Error> {
  if (input.visibility === undefined) return null
  const records = await new SystemNotificationReferenceAdapter({
    database: drizzle(input.database),
  }).findMany(input)
  if (records instanceof Error) return records
  return input.visibility.selectVisibleDeliveryIds({
    recipientAccountId: input.recipientAccountId,
    records,
  })
}
