import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  InvalidNotificationDeliveryError,
  type InvalidNotificationDeliveryReason,
} from "@system/domain/errors"
import type { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import type { NotificationDeliveryId } from "@system/domain/schemas/notifications/notification-delivery-id.schema"
import type { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"

type Props = Readonly<{
  notificationRepository: Pick<SystemNotificationRepository, "markDeliveryRead">
}>

export type MarkSystemNotificationReadCommand = Readonly<{
  deliveryId: NotificationDeliveryId
  recipientAccountId: AccountId
  readAt: Date
}>

export type MarkSystemNotificationReadResult =
  | Readonly<{ kind: "marked"; delivery: NotificationDeliveryEntity }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "rejected"; reason: InvalidNotificationDeliveryReason }>
type MarkSystemNotificationReadContext = Props
type Context = MarkSystemNotificationReadContext

/** Account所有境界を保ったままread receiptを単調に更新する。 */
export class MarkSystemNotificationRead {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    command: MarkSystemNotificationReadCommand,
  ): Promise<MarkSystemNotificationReadResult | Error> {
    if (!(command.readAt instanceof Date) || !Number.isFinite(command.readAt.getTime())) {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid_shape" as const })
    }

    const delivery = await this.c.notificationRepository.markDeliveryRead(command)

    if (delivery instanceof InvalidNotificationDeliveryError) {
      return Object.freeze({ kind: "rejected" as const, reason: delivery.reason })
    }
    if (delivery instanceof Error) return delivery
    if (delivery === null) return Object.freeze({ kind: "not_found" as const })

    return Object.freeze({ kind: "marked" as const, delivery })
  }
}
