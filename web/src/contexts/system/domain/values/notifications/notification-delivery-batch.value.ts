import { InvalidNotificationDeliveryBatchError } from "@system/domain/errors"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"

/**
 * fan-out書き込み前にdelivery IDとMessage/Account組の一意性を保証する。
 * adapterは同じ一意性を永続化境界でも再検査する。
 */
export class NotificationDeliveryBatchValue {
  readonly deliveries: ReadonlyArray<NotificationDeliveryEntity>

  private constructor(deliveries: ReadonlyArray<NotificationDeliveryEntity>) {
    this.deliveries = Object.freeze([...deliveries])
    Object.freeze(this)
  }

  static create(
    input: unknown,
  ): NotificationDeliveryBatchValue | InvalidNotificationDeliveryBatchError {
    if (
      !Array.isArray(input) ||
      !input.every((delivery) => delivery instanceof NotificationDeliveryEntity)
    ) {
      return new InvalidNotificationDeliveryBatchError("invalid_shape")
    }

    const ids = new Set<string>()
    const recipientsByMessage = new Map<string, Set<string>>()

    for (const delivery of input) {
      if (ids.has(delivery.id)) {
        return new InvalidNotificationDeliveryBatchError("duplicate_delivery_id")
      }
      ids.add(delivery.id)

      const recipients = recipientsByMessage.get(delivery.messageId) ?? new Set<string>()
      if (recipients.has(delivery.recipientAccountId)) {
        return new InvalidNotificationDeliveryBatchError("duplicate_message_recipient")
      }
      recipients.add(delivery.recipientAccountId)
      recipientsByMessage.set(delivery.messageId, recipients)
    }

    return new NotificationDeliveryBatchValue(input)
  }
}
