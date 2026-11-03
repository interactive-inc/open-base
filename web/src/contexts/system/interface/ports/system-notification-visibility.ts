import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemNotificationReference } from "@system/infrastructure/adapters/notifications/system-notification-reference.adapter"

/** 不透明な参照の現在の可視性を、合成側が受信Accountごとに解決する。 */
export type SystemNotificationVisibility = Readonly<{
  selectVisibleDeliveryIds(
    input: Readonly<{
      recipientAccountId: AccountId
      records: ReadonlyArray<SystemNotificationReference>
    }>,
  ): Promise<ReadonlyArray<string>>
}>
