import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  InvalidNotificationDeliveryError,
  type InvalidNotificationDeliveryReason,
} from "@system/domain/errors"
import type { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import type { NotificationDeliveryId } from "@system/domain/schemas/notifications/notification-delivery-id.schema"
import type { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"

type Props = Readonly<{
  notificationRepository: Pick<
    SystemNotificationRepository,
    "findDeliveryByIdForAccount" | "dismissDelivery"
  >
}>

export type DismissSystemNotificationCommand = Readonly<{
  deliveryId: NotificationDeliveryId
  recipientAccountId: AccountId
  dismissedAt: Date
}>

export type DismissSystemNotificationResult =
  | Readonly<{ kind: "dismissed"; delivery: NotificationDeliveryEntity }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "rejected"; reason: InvalidNotificationDeliveryReason }>
type DismissSystemNotificationContext = Props
type Context = DismissSystemNotificationContext

/** Account所有境界を保ったままDeliveryを一度だけ非表示へ遷移する。 */
export class DismissSystemNotification {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    command: DismissSystemNotificationCommand,
  ): Promise<DismissSystemNotificationResult | Error> {
    if (!(command.dismissedAt instanceof Date) || !Number.isFinite(command.dismissedAt.getTime())) {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid_shape" as const })
    }

    const delivery = await this.c.notificationRepository.findDeliveryByIdForAccount(
      command.deliveryId,
      command.recipientAccountId,
    )
    if (delivery instanceof Error) return delivery
    if (delivery === null || delivery.isDismissed) {
      return Object.freeze({ kind: "not_found" as const })
    }

    const dismissed = delivery.dismiss(command.dismissedAt)
    if (dismissed instanceof InvalidNotificationDeliveryError) {
      return Object.freeze({ kind: "rejected" as const, reason: dismissed.reason })
    }
    const dismissedAt = dismissed.dismissedAt
    if (dismissedAt === null) return new Error("System Notification dismissal time is missing")

    const persisted = await this.c.notificationRepository.dismissDelivery(
      dismissed.id,
      dismissed.recipientAccountId,
      dismissedAt,
    )
    if (persisted instanceof Error) return persisted
    if (!persisted) return Object.freeze({ kind: "not_found" as const })

    return Object.freeze({ kind: "dismissed" as const, delivery: dismissed })
  }
}
